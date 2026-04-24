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
    appointment: {
      findFirst: vi.fn(),
    },
    appointmentResponse: {
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

    it('does NOT create a new VisitRequest when the reply matches an open appointment', async () => {
      // Regression: recordAppointmentResponseIfAny used to run purely
      // for the audit trail and then fall through to the normal
      // new-enquiry path. That meant every "cancel"/"reschedule" reply
      // to a confirmation spawned a phantom UNTRIAGED VisitRequest in
      // the planning pool. The webhook now short-circuits when a
      // match is found.
      mockPrisma.enquiry.findUnique.mockResolvedValue(null);
      mockPrisma.customer.upsert.mockResolvedValue({ id: 'cust-1', deletedAt: null });
      mockPrisma.enquiry.create.mockResolvedValue({ id: 'enq-1' });
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' });
      mockPrisma.appointmentResponse.create.mockResolvedValue({ id: 'ar-1' });

      const cancelPayload = {
        ...validPayload,
        entry: [{
          ...validPayload.entry[0],
          changes: [{
            ...validPayload.entry[0].changes[0],
            value: {
              ...validPayload.entry[0].changes[0].value,
              messages: [{
                id: 'wamid.cancel-reply',
                from: '447700900002',
                timestamp: '1700000000',
                type: 'text',
                text: { body: 'Please cancel my appointment, thanks' },
              }],
            },
          }],
        }],
      };

      const response = await POST(makeSignedRequest(cancelPayload));
      expect(response.status).toBe(200);

      // Give the async `processWebhookPayload` a tick to run — the
      // handler returns 200 immediately and processes in the
      // background.
      await new Promise((r) => setTimeout(r, 10));

      // AppointmentResponse was logged...
      expect(mockPrisma.appointmentResponse.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          appointmentId: 'appt-1',
          kind: 'CANCELLED',
          channel: 'WHATSAPP',
        }),
      });
      // ...and the phantom new-enquiry VisitRequest was NOT created.
      expect(mockPrisma.visitRequest.create).not.toHaveBeenCalled();
    });

    it('DOES create a new VisitRequest when the customer has no open appointment', async () => {
      // Sanity check: the fresh-enquiry path is unchanged when there
      // is no open appointment to match against.
      mockPrisma.enquiry.findUnique.mockResolvedValue(null);
      mockPrisma.customer.upsert.mockResolvedValue({ id: 'cust-2', deletedAt: null });
      mockPrisma.enquiry.create.mockResolvedValue({ id: 'enq-2' });
      mockPrisma.appointment.findFirst.mockResolvedValue(null);
      mockPrisma.visitRequest.create.mockResolvedValue({ id: 'vr-2' });

      const response = await POST(makeSignedRequest(validPayload));
      expect(response.status).toBe(200);
      await new Promise((r) => setTimeout(r, 10));

      expect(mockPrisma.appointmentResponse.create).not.toHaveBeenCalled();
      expect(mockPrisma.visitRequest.create).toHaveBeenCalledTimes(1);
    });
  });
});
