import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockPrisma = vi.hoisted(() => ({
  enquiry: {
    findUnique: vi.fn(),
  },
}));

const mockAutoTriageService = vi.hoisted(() => ({
  triageEnquiry: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  env: {
    N8N_API_KEY: 'test-api-key',
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/services/auto-triage.service', () => ({
  autoTriageService: mockAutoTriageService,
}));

import { POST } from '@/app/api/triage-ops/classify/route';

function createClassifyRequest(body: unknown, apiKey: string = 'test-api-key'): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/triage-ops/classify'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/triage-ops/classify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns triage result at the top level for n8n consumers', async () => {
    mockPrisma.enquiry.findUnique.mockResolvedValue({
      id: 'enq-1',
      rawText: 'Horse needs a check-up',
      visitRequests: [{ id: 'vr-1' }],
    });
    mockAutoTriageService.triageEnquiry.mockResolvedValue({
      visitRequestId: 'vr-1',
      needsMoreInfo: true,
      planningStatus: 'NEEDS_INFO',
      urgency: 'ROUTINE',
    });

    const response = await POST(createClassifyRequest({ enquiryId: 'enq-1' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      visitRequestId: 'vr-1',
      needsMoreInfo: true,
      planningStatus: 'NEEDS_INFO',
    });
    expect(data.data).toBeUndefined();
  });

  it('rejects requests without a valid n8n API key', async () => {
    const response = await POST(createClassifyRequest({ enquiryId: 'enq-1' }, 'wrong-key'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: 'Unauthorized' });
  });
});
