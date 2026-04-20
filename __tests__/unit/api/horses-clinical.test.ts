import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockClinicalRecordService } = vi.hoisted(() => ({
  mockClinicalRecordService: {
    listDentalCharts: vi.fn(),
    listFindings: vi.fn(),
    listPrescriptions: vi.fn(),
    createDentalChart: vi.fn(),
    createFinding: vi.fn(),
    createPrescription: vi.fn(),
  },
}));

vi.mock('@/lib/services/clinical-record.service', () => ({
  clinicalRecordService: mockClinicalRecordService,
}));

import { POST } from '@/app/api/horses/[id]/clinical/route';

function createClinicalRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/horses/horse-1/clinical', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/horses/[id]/clinical', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for whitespace-only finding descriptions', async () => {
    const response = await POST(createClinicalRequest({ kind: 'finding', description: '   ' }), {
      params: Promise.resolve({ id: 'horse-1' }),
    });

    expect(response.status).toBe(400);
    expect(mockClinicalRecordService.createFinding).not.toHaveBeenCalled();
  });

  it.each([
    { field: 'medicineName', body: { kind: 'prescription', medicineName: '   ', dosage: '10 mg' } },
    { field: 'dosage', body: { kind: 'prescription', medicineName: 'Bute', dosage: '   ' } },
  ])('returns 400 for whitespace-only prescription $field', async ({ body }) => {
    const response = await POST(createClinicalRequest(body), {
      params: Promise.resolve({ id: 'horse-1' }),
    });

    expect(response.status).toBe(400);
    expect(mockClinicalRecordService.createPrescription).not.toHaveBeenCalled();
  });
});
