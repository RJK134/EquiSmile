/**
 * Coverage for the GET /api/horses/[id] response shape after the May 2026
 * client user-story triage Phase A.2 (G-6a) extended it to include four
 * clinical-history relations: dentalCharts, findings, prescriptions,
 * attachments — newest 5 of each.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const requireRoleMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/auth/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/rbac')>('@/lib/auth/rbac');
  return { ...actual, requireRole: requireRoleMock };
});

vi.mock('@/lib/services/security-audit.service', () => ({
  securityAuditService: { record: vi.fn() },
}));

vi.mock('@/lib/services/audit-log.service', () => ({
  auditLogService: { record: vi.fn(), listForEntity: vi.fn(), recent: vi.fn() },
}));

const mockHorseRepo = {
  findById: vi.fn(),
  findByIdWithClinicalHistory: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/repositories/horse.repository', () => ({
  horseRepository: mockHorseRepo,
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

function signedInAs(role: 'admin' | 'vet' | 'nurse' | 'readonly') {
  requireRoleMock.mockResolvedValue({
    id: 'u1',
    email: 'vet@example.com',
    githubLogin: 'vet1',
    role,
    actorLabel: 'vet1',
  });
}

const horseWithHistory = {
  id: 'h1',
  horseName: 'Bella',
  age: 8,
  notes: null,
  dentalDueDate: null,
  active: true,
  customer: { id: 'c1', fullName: 'Marie Dupont' },
  primaryYard: { id: 'y1', yardName: 'Centre Équestre Riviera', postcode: '1820' },
  dentalCharts: [
    { id: 'chart1', recordedAt: new Date('2026-04-01'), generalNotes: 'Annual check', appointmentId: null },
  ],
  findings: [
    {
      id: 'f1',
      findingDate: new Date('2026-04-01'),
      toothId: '107',
      category: 'HOOK',
      severity: 'MILD',
      description: 'Mild hook',
    },
  ],
  prescriptions: [
    {
      id: 'rx1',
      prescribedAt: new Date('2026-04-01'),
      medicineName: 'Bute',
      dosage: '2 mg/kg PO BID',
      durationDays: 5,
      status: 'ACTIVE',
    },
  ],
  attachments: [
    { id: 'att1', uploadedAt: new Date('2026-04-01'), kind: 'PHOTO', description: 'Pre-floating' },
  ],
};

describe('GET /api/horses/[id] — clinical history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs('vet');
  });

  it('calls findByIdWithClinicalHistory (not bare findById) so relations land in the response', async () => {
    mockHorseRepo.findByIdWithClinicalHistory.mockResolvedValue(horseWithHistory);

    const { GET } = await import('@/app/api/horses/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/horses/h1');
    const response = await GET(request, { params: Promise.resolve({ id: 'h1' }) });

    expect(response.status).toBe(200);
    expect(mockHorseRepo.findByIdWithClinicalHistory).toHaveBeenCalledWith('h1');
    expect(mockHorseRepo.findById).not.toHaveBeenCalled();
  });

  it('returns the four clinical relations in the response body', async () => {
    mockHorseRepo.findByIdWithClinicalHistory.mockResolvedValue(horseWithHistory);

    const { GET } = await import('@/app/api/horses/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/horses/h1');
    const response = await GET(request, { params: Promise.resolve({ id: 'h1' }) });
    const body = await response.json();

    expect(body.dentalCharts).toHaveLength(1);
    expect(body.dentalCharts[0].id).toBe('chart1');
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0].toothId).toBe('107');
    expect(body.prescriptions).toHaveLength(1);
    expect(body.prescriptions[0].medicineName).toBe('Bute');
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].kind).toBe('PHOTO');
  });

  it('returns 404 when horse not found', async () => {
    mockHorseRepo.findByIdWithClinicalHistory.mockResolvedValue(null);

    const { GET } = await import('@/app/api/horses/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/horses/missing');
    const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) });

    expect(response.status).toBe(404);
  });

  it('rejects with 401/403 when no session/role', async () => {
    requireRoleMock.mockRejectedValueOnce(
      Object.assign(new Error('Unauthenticated'), { name: 'AuthzError', code: 'NO_SESSION' }),
    );
    // The route catches AuthzError and returns the authzErrorResponse
    // wrapper. We assert the call attempted requireRole; the behaviour
    // of authzErrorResponse is covered by lib/auth/rbac.test.ts.
    const { GET } = await import('@/app/api/horses/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/horses/h1');
    const response = await GET(request, { params: Promise.resolve({ id: 'h1' }) });
    // Response is one of 401/403 depending on the AuthzError code shape.
    expect([401, 403]).toContain(response.status);
  });
});
