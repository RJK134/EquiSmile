import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    N8N_API_KEY: 'test-api-key',
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    SMTP_PORT: '587',
    SMTP_FROM: '',
  },
}));

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
    // Phase 16 — webhook handlers now wrap the customer lookup +
    // enquiry create in `$transaction`. The mock just invokes the
    // callback with the same prisma surface so the assertions keep
    // working.
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

import { POST } from '@/app/api/webhooks/email/route';
import { NextRequest } from 'next/server';

function createEmailRequest(body: unknown, apiKey: string = 'test-api-key'): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/webhooks/email'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

describe('Email Intake Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload = {
    from: 'jane@example.com',
    fromName: 'Jane Smith',
    subject: 'Dental check for 2 horses',
    textBody: 'Hi, I need dental work for my 2 horses.',
    messageId: '<abc123@mail.example.com>',
    receivedAt: '2024-01-15T10:30:00Z',
  };

  it('creates enquiry from valid payload', async () => {
    mockPrisma.enquiry.findUnique.mockResolvedValue(null);
    mockPrisma.customer.findUnique.mockResolvedValue(null);
    mockPrisma.customer.create.mockResolvedValue({ id: 'cust-1' });
    mockPrisma.enquiry.create.mockResolvedValue({ id: 'enq-1', customerId: 'cust-1' });
    mockPrisma.visitRequest.create.mockResolvedValue({ id: 'vr-1' });

    const request = createEmailRequest(validPayload);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.enquiryId).toBe('enq-1');
    expect(data.isNew).toBe(true);
  });

  it('returns existing enquiry for duplicate messageId', async () => {
    mockPrisma.enquiry.findUnique.mockResolvedValue({
      id: 'existing-enq',
      customerId: 'cust-1',
    });

    const request = createEmailRequest(validPayload);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.enquiryId).toBe('existing-enq');
    expect(data.isNew).toBe(false);
  });

  it('returns 401 for invalid API key', async () => {
    const request = createEmailRequest(validPayload, 'wrong-key');
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid payload', async () => {
    const request = createEmailRequest({ from: 'test@test.com' });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('matches existing customer by email', async () => {
    mockPrisma.enquiry.findUnique.mockResolvedValue(null);
    mockPrisma.customer.findUnique.mockResolvedValue({ id: 'existing-cust' });
    mockPrisma.enquiry.create.mockResolvedValue({ id: 'enq-1', customerId: 'existing-cust' });
    mockPrisma.visitRequest.create.mockResolvedValue({ id: 'vr-1' });

    const request = createEmailRequest(validPayload);
    const response = await POST(request);
    const data = await response.json();

    expect(data.isNew).toBe(false);
    expect(mockPrisma.customer.create).not.toHaveBeenCalled();
  });
});
