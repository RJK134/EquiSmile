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

const mockEnquiryRepo = {
  findMany: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/repositories/enquiry.repository', () => ({
  enquiryRepository: mockEnquiryRepo,
}));

vi.mock('@/lib/services/enquiry.service', () => ({
  enquiryService: { createManualEnquiry: vi.fn() },
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

describe('GET /api/enquiries — includeDeleted admin gating (Bugbot #2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnquiryRepo.findMany.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });

  it('silently downgrades includeDeleted=true for a readonly session', async () => {
    // Without this gate any READONLY role could URL-hack ?includeDeleted=true
    // and read inbound customer messages from tombstoned enquiries.
    signedInAs('readonly');
    const { GET } = await import('@/app/api/enquiries/route');
    const request = new NextRequest('http://localhost:3000/api/enquiries?includeDeleted=true');
    await GET(request);
    expect(mockEnquiryRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: false }),
    );
  });

  it('silently downgrades includeDeleted=true for a vet session', async () => {
    signedInAs('vet');
    const { GET } = await import('@/app/api/enquiries/route');
    const request = new NextRequest('http://localhost:3000/api/enquiries?includeDeleted=true');
    await GET(request);
    expect(mockEnquiryRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: false }),
    );
  });

  it('honours includeDeleted=true for an admin session', async () => {
    signedInAs('admin');
    const { GET } = await import('@/app/api/enquiries/route');
    const request = new NextRequest('http://localhost:3000/api/enquiries?includeDeleted=true');
    await GET(request);
    expect(mockEnquiryRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: true }),
    );
  });

  it('treats absent flag as false', async () => {
    signedInAs('admin');
    const { GET } = await import('@/app/api/enquiries/route');
    const request = new NextRequest('http://localhost:3000/api/enquiries');
    await GET(request);
    expect(mockEnquiryRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: false }),
    );
  });
});

describe('DELETE /api/enquiries/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs('admin');
  });

  it('soft-deletes the enquiry, returns 200, writes both audit trails', async () => {
    mockEnquiryRepo.delete.mockResolvedValue({ id: 'e1' });

    const { DELETE } = await import('@/app/api/enquiries/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/enquiries/e1', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'e1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(mockEnquiryRepo.delete).toHaveBeenCalledWith('e1', 'u1');

    expect(securityAuditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ENQUIRY_DELETED',
        targetType: 'Enquiry',
        targetId: 'e1',
      }),
    );
    expect(auditLogRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ENQUIRY_DELETED',
        entityType: 'Enquiry',
        entityId: 'e1',
      }),
    );
  });

  it('rejects deletion below admin role', async () => {
    requireRoleMock.mockImplementation(async () => {
      const { AuthzError } = await import('@/lib/auth/rbac');
      throw new AuthzError('Insufficient role: admin required', 403);
    });

    const { DELETE } = await import('@/app/api/enquiries/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/enquiries/e1', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'e1' }) });

    expect(response.status).toBe(403);
    expect(mockEnquiryRepo.delete).not.toHaveBeenCalled();
    expect(securityAuditRecordMock).not.toHaveBeenCalled();
    expect(auditLogRecordMock).not.toHaveBeenCalled();
  });
});
