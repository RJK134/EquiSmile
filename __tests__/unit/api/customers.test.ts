import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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

vi.mock('@/lib/auth/api', () => ({
  requireActorWithRole: vi.fn().mockResolvedValue({
    userId: 'user-1',
    staffId: 'staff-1',
    role: 'admin',
    email: 'admin@example.com',
    githubLogin: 'admin',
    performedBy: 'admin',
  }),
}));

vi.mock('@/lib/services/security-audit.service', () => ({
  securityAuditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('GET /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

describe('POST /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('deletes a customer', async () => {
    mockCustomerRepo.delete.mockResolvedValue({ id: '1' });

    const { DELETE } = await import('@/app/api/customers/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/customers/1', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: '1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toBe(true);
  });
});
