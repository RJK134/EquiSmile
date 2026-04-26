import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const requireRoleMock = vi.hoisted(() => vi.fn());
const securityAuditRecordMock = vi.hoisted(() => vi.fn());
const auditLogRecordMock = vi.hoisted(() => vi.fn());

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
  securityAuditService: { record: securityAuditRecordMock },
}));

vi.mock('@/lib/services/audit-log.service', () => ({
  auditLogService: { record: auditLogRecordMock, listForEntity: vi.fn(), recent: vi.fn() },
}));

const mockHorseRepo = {
  findById: vi.fn(),
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

describe('DELETE /api/horses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Horse deletion is VET+ rather than ADMIN-only — clinical record
    // mutation is part of the vet's day-to-day work. The dual-write
    // rule still applies.
    signedInAs('vet');
  });

  it('soft-deletes the horse and dual-writes both audit trails', async () => {
    mockHorseRepo.delete.mockResolvedValue({ id: 'h1' });

    const { DELETE } = await import('@/app/api/horses/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/horses/h1', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'h1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mockHorseRepo.delete).toHaveBeenCalledWith('h1', 'u1');
    expect(securityAuditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'HORSE_DELETED',
        targetType: 'Horse',
        targetId: 'h1',
      }),
    );
    expect(auditLogRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HORSE_DELETED',
        entityType: 'Horse',
        entityId: 'h1',
      }),
    );
  });

  it('rejects deletion when role is below vet', async () => {
    requireRoleMock.mockImplementation(async () => {
      const { AuthzError } = await import('@/lib/auth/rbac');
      throw new AuthzError('Insufficient role: vet required', 403);
    });

    const { DELETE } = await import('@/app/api/horses/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/horses/h1', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'h1' }) });

    expect(response.status).toBe(403);
    expect(mockHorseRepo.delete).not.toHaveBeenCalled();
    expect(securityAuditRecordMock).not.toHaveBeenCalled();
    expect(auditLogRecordMock).not.toHaveBeenCalled();
  });
});
