import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    N8N_API_KEY: 'test-api-key',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_ACCESS_TOKEN: '',
    WHATSAPP_API_TOKEN: '',
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    SMTP_PORT: '587',
    SMTP_FROM: '',
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: { findUnique: vi.fn() },
    enquiryMessage: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('@/lib/services/message-log.service', () => ({
  messageLogService: {
    logMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
  },
}));

vi.mock('@/lib/services/whatsapp.service', () => ({
  whatsappService: {
    sendTextMessage: vi.fn().mockResolvedValue({ messageId: 'wa-123', success: true }),
    sendTemplateMessage: vi.fn().mockResolvedValue({ messageId: 'wa-456', success: true }),
  },
}));

vi.mock('@/lib/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ messageId: 'em-123', success: true }),
    sendBrandedEmail: vi.fn().mockResolvedValue({ messageId: 'em-456', success: true }),
  },
}));

vi.mock('@/lib/services/geocoding.service', () => ({
  geocodingService: {
    updateYardCoordinates: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/lib/repositories/route-run.repository', () => ({
  routeRunRepository: {
    create: vi.fn().mockResolvedValue({ id: 'rr-1' }),
    createStops: vi.fn().mockResolvedValue({ count: 1 }),
  },
}));

import { POST as triagePost } from '@/app/api/n8n/triage-result/route';
import { POST as geocodePost } from '@/app/api/n8n/geocode-result/route';
import { POST as routePost } from '@/app/api/n8n/route-proposal/route';
import { NextRequest } from 'next/server';

function createAuthRequest(url: string, body: unknown, apiKey: string = 'test-api-key'): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

describe('n8n Contract Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/n8n/triage-result', () => {
    it('accepts valid triage result', async () => {
      const request = createAuthRequest('/api/n8n/triage-result', {
        enquiryId: '550e8400-e29b-41d4-a716-446655440000',
        visitRequestId: '550e8400-e29b-41d4-a716-446655440001',
        requestType: 'ROUTINE_DENTAL',
        urgencyLevel: 'ROUTINE',
        confidence: 0.9,
      });
      const response = await triagePost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('rejects invalid API key', async () => {
      const request = createAuthRequest('/api/n8n/triage-result', {
        enquiryId: '550e8400-e29b-41d4-a716-446655440000',
        visitRequestId: '550e8400-e29b-41d4-a716-446655440001',
        requestType: 'ROUTINE_DENTAL',
        urgencyLevel: 'ROUTINE',
      }, 'wrong-key');
      const response = await triagePost(request);
      expect(response.status).toBe(401);
    });

    it('rejects invalid payload', async () => {
      const request = createAuthRequest('/api/n8n/triage-result', {
        enquiryId: 'not-a-uuid',
      });
      const response = await triagePost(request);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/n8n/geocode-result', () => {
    it('accepts valid geocode result', async () => {
      const request = createAuthRequest('/api/n8n/geocode-result', {
        yardId: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 51.5074,
        longitude: -0.1278,
        formattedAddress: 'London, UK',
      });
      const response = await geocodePost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('rejects unauthorized request', async () => {
      const request = createAuthRequest('/api/n8n/geocode-result', {
        yardId: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 51.5074,
        longitude: -0.1278,
      }, 'bad-key');
      const response = await geocodePost(request);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/n8n/route-proposal', () => {
    it('accepts valid route proposal', async () => {
      const request = createAuthRequest('/api/n8n/route-proposal', {
        runDate: '2024-03-15',
        stops: [
          {
            yardId: '550e8400-e29b-41d4-a716-446655440000',
            sequenceNo: 1,
          },
        ],
        totalDistanceMeters: 50000,
      });
      const response = await routePost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
