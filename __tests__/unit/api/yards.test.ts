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

const mockYardRepo = {
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/repositories/yard.repository', () => ({
  yardRepository: mockYardRepo,
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

describe('DELETE /api/yards/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs('admin');
  });

  it('soft-deletes the yard and dual-writes both audit trails', async () => {
    // Dual-write rule (docs/ARCHITECTURE.md → "Audit trail"):
    //   - SecurityAuditLog: tamper-evident security-event timeline.
    //   - AuditLog:         per-entity history at /admin/observability.
    mockYardRepo.delete.mockResolvedValue({ id: 'y1' });

    const { DELETE } = await import('@/app/api/yards/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/yards/y1', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'y1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mockYardRepo.delete).toHaveBeenCalledWith('y1', 'u1');
    expect(securityAuditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'YARD_DELETED',
        targetType: 'Yard',
        targetId: 'y1',
      }),
    );
    expect(auditLogRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'YARD_DELETED',
        entityType: 'Yard',
        entityId: 'y1',
      }),
    );
  });

  it('rejects deletion when role is below admin', async () => {
    requireRoleMock.mockImplementation(async () => {
      const { AuthzError } = await import('@/lib/auth/rbac');
      throw new AuthzError('Insufficient role: admin required', 403);
    });

    const { DELETE } = await import('@/app/api/yards/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/yards/y1', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'y1' }) });

    expect(response.status).toBe(403);
    expect(mockYardRepo.delete).not.toHaveBeenCalled();
    expect(securityAuditRecordMock).not.toHaveBeenCalled();
    expect(auditLogRecordMock).not.toHaveBeenCalled();
  });
});
