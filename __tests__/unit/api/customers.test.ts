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

const mockCustomerRepo = {
  findMany: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/repositories/customer.repository', () => ({
  customerRepository: mockCustomerRepo,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

function signedInAs(role: 'admin' | 'vet' | 'nurse' | 'readonly') {
  requireRoleMock.mockResolvedValue({
    id: 'u1',
    email: 'vet@example.com',
    githubLogin: 'vet1',
    role,
    actorLabel: 'vet1',
  });
}

describe('GET /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs('readonly');
  });

  it('returns paginated customers', async () => {
    mockCustomerRepo.findMany.mockResolvedValue({
      data: [{ id: '1', fullName: 'Sarah Jones' }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const { GET } = await import('@/app/api/customers/route');
    const request = new NextRequest('http://localhost:3000/api/customers');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('passes query params to repository', async () => {
    mockCustomerRepo.findMany.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    const { GET } = await import('@/app/api/customers/route');
    const request = new NextRequest('http://localhost:3000/api/customers?search=Jones&preferredChannel=EMAIL');
    await GET(request);

    expect(mockCustomerRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Jones',
        preferredChannel: 'EMAIL',
      })
    );
  });

  describe('includeDeleted admin gating', () => {
    it('silently drops includeDeleted=true for a non-admin (vet) session', async () => {
      // Critical: without this gate, any authenticated vet could
      // URL-hack `?includeDeleted=true` and see soft-deleted PII.
      signedInAs('vet');
      mockCustomerRepo.findMany.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const { GET } = await import('@/app/api/customers/route');
      const request = new NextRequest(
        'http://localhost:3000/api/customers?includeDeleted=true',
      );
      await GET(request);

      expect(mockCustomerRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ includeDeleted: false }),
      );
    });

    it('honours includeDeleted=true for an admin session', async () => {
      signedInAs('admin');
      mockCustomerRepo.findMany.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const { GET } = await import('@/app/api/customers/route');
      const request = new NextRequest(
        'http://localhost:3000/api/customers?includeDeleted=true',
      );
      await GET(request);

      expect(mockCustomerRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ includeDeleted: true }),
      );
    });
  });
});

describe('POST /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs('nurse');
  });

  it('creates a customer with valid data', async () => {
    const newCustomer = { id: '1', fullName: 'New User', preferredChannel: 'WHATSAPP', preferredLanguage: 'en' };
    mockCustomerRepo.create.mockResolvedValue(newCustomer);

    const { POST } = await import('@/app/api/customers/route');
    const request = new NextRequest('http://localhost:3000/api/customers', {
      method: 'POST',
      body: JSON.stringify({ fullName: 'New User' }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.fullName).toBe('New User');
  });

  it('returns 400 for invalid data', async () => {
    const { POST } = await import('@/app/api/customers/route');
    const request = new NextRequest('http://localhost:3000/api/customers', {
      method: 'POST',
      body: JSON.stringify({ fullName: '' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid channel', async () => {
    const { POST } = await import('@/app/api/customers/route');
    const request = new NextRequest('http://localhost:3000/api/customers', {
      method: 'POST',
      body: JSON.stringify({ fullName: 'Test', preferredChannel: 'FAX' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

describe('GET /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs('readonly');
  });

  it('returns customer by id', async () => {
    const customer = { id: '1', fullName: 'Sarah', yards: [], horses: [], enquiries: [] };
    mockCustomerRepo.findById.mockResolvedValue(customer);

    const { GET } = await import('@/app/api/customers/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/customers/1');
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fullName).toBe('Sarah');
  });

  it('returns 404 for non-existent customer', async () => {
    mockCustomerRepo.findById.mockResolvedValue(null);

    const { GET } = await import('@/app/api/customers/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/customers/nonexistent');
    const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });

    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs('nurse');
  });

  it('updates customer with valid data', async () => {
    const updated = { id: '1', fullName: 'Updated Name' };
    mockCustomerRepo.update.mockResolvedValue(updated);

    const { PATCH } = await import('@/app/api/customers/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/customers/1', {
      method: 'PATCH',
      body: JSON.stringify({ fullName: 'Updated Name' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: '1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fullName).toBe('Updated Name');
  });
});

describe('DELETE /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs('admin');
  });

  it('deletes a customer and dual-writes both audit trails', async () => {
    // The dual-write rule (see docs/ARCHITECTURE.md → "Audit trail"):
    //   - SecurityAuditLog: tamper-evident security-event timeline.
    //   - AuditLog:         per-entity history at /admin/observability.
    // Removing either is a regression — both must fire on every soft-delete.
    mockCustomerRepo.delete.mockResolvedValue({ id: '1' });

    const { DELETE } = await import('@/app/api/customers/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/customers/1', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
    expect(securityAuditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'CUSTOMER_DELETED',
        targetType: 'Customer',
        targetId: '1',
      }),
    );
    expect(auditLogRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CUSTOMER_DELETED',
        entityType: 'Customer',
        entityId: '1',
      }),
    );
  });

  it('rejects deletion when role is below admin', async () => {
    requireRoleMock.mockImplementation(async () => {
      const { AuthzError } = await import('@/lib/auth/rbac');
      throw new AuthzError('Insufficient role: admin required', 403);
    });

    const { DELETE } = await import('@/app/api/customers/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/customers/1', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(403);
    expect(mockCustomerRepo.delete).not.toHaveBeenCalled();
    expect(securityAuditRecordMock).not.toHaveBeenCalled();
    expect(auditLogRecordMock).not.toHaveBeenCalled();
  });
});
