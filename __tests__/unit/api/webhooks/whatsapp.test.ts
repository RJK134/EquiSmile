import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// Mock env
vi.mock('@/lib/env', () => ({
  env: {
    WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
    WHATSAPP_APP_SECRET: 'test-app-secret',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_ACCESS_TOKEN: '',
    WHATSAPP_API_TOKEN: '',
  },
}));

// Mock prisma
const mockPrisma = vi.hoisted(() => {
  const surface = {
    enquiry: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    customer: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    yard: {
      updateMany: vi.fn(),
    },
    horse: {
      updateMany: vi.fn(),
    },
    visitRequest: {
      create: vi.fn(),
    },
    enquiryMessage: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    ...surface,
    $transaction: vi.fn(async (cb: (tx: typeof surface) => unknown) => cb(surface)),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/services/message-log.service', () => ({
  messageLogService: {
    logMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
  },
}));

import { GET, POST } from '@/app/api/webhooks/whatsapp/route';
import { NextRequest } from 'next/server';

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('WhatsApp Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET - Webhook Verification', () => {
    it('returns challenge on valid token', async () => {
      const request = createRequest(
        'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=test-challenge-123'
      );
      const response = await GET(request);
      const text = await response.text();
      expect(response.status).toBe(200);
      expect(text).toBe('test-challenge-123');
    });

    it('returns 403 on invalid token', async () => {
      const request = createRequest(
        'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=test'
      );
      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it('returns 403 when mode is not subscribe', async () => {
      const request = createRequest(
        'http://localhost:3000/api/webhooks/whatsapp?hub.mode=unsubscribe&hub.verify_token=test-verify-token&hub.challenge=test'
      );
      const response = await GET(request);
      expect(response.status).toBe(403);
    });
  });

  describe('POST - Incoming Messages', () => {
    const validPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '447700900001', phone_number_id: '12345' },
                contacts: [{ profile: { name: 'Jane Smith' }, wa_id: '447700900002' }],
                messages: [
                  {
                    id: 'wamid.abc123',
                    from: '447700900002',
                    timestamp: '1700000000',
                    type: 'text',
                    text: { body: 'Hi, I need dental work for 3 horses' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    function makeSignedRequest(payload: unknown): NextRequest {
      const body = JSON.stringify(payload);
      const signature =
        'sha256=' + createHmac('sha256', 'test-app-secret').update(body).digest('hex');
      return new NextRequest(new URL('http://localhost:3000/api/webhooks/whatsapp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
        body,
      });
    }

    it('returns 200 for valid signed payload', async () => {
      mockPrisma.enquiry.findUnique.mockResolvedValue(null);
      mockPrisma.customer.findUnique.mockResolvedValue(null);
      mockPrisma.customer.upsert.mockImplementation(async ({ create }) => ({
        id: create.id,
        deletedAt: null,
      }));
      mockPrisma.enquiry.create.mockResolvedValue({ id: 'enq-1' });
      mockPrisma.visitRequest.create.mockResolvedValue({ id: 'vr-1' });

      const request = makeSignedRequest(validPayload);
      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('returns 401 for invalid signature', async () => {
      const body = JSON.stringify(validPayload);
      const request = new NextRequest(new URL('http://localhost:3000/api/webhooks/whatsapp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=invalidsignature',
        },
        body,
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid JSON', async () => {
      const body = 'not-json';
      const signature =
        'sha256=' + createHmac('sha256', 'test-app-secret').update(body).digest('hex');
      const request = new NextRequest(new URL('http://localhost:3000/api/webhooks/whatsapp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': signature,
        },
        body,
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
