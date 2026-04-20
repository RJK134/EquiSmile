import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const uploadMock = vi.hoisted(() => vi.fn());
const requireRoleMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/attachment.service', () => ({
  attachmentService: {
    upload: uploadMock,
    listForHorse: vi.fn(),
  },
  ATTACHMENT_LIMITS: {
    MAX_BYTES: 25 * 1024 * 1024,
    ALLOWED_MIMES: new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ]),
  },
}));

class MockAuthzError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

vi.mock('@/lib/auth/rbac', () => ({
  requireRole: requireRoleMock,
  authzErrorResponse: vi.fn(),
  AuthzError: MockAuthzError,
  ROLES: {
    ADMIN: 'admin',
    VET: 'vet',
    NURSE: 'nurse',
    READONLY: 'readonly',
  },
}));

describe('POST /api/horses/[id]/attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attributes uploads to the authenticated subject instead of the form field', async () => {
    requireRoleMock.mockResolvedValue({
      id: 'session-user',
      email: 'vet@example.com',
      githubLogin: 'vet',
      role: 'vet',
      actorLabel: 'vet',
    });
    uploadMock.mockResolvedValue({ id: 'attachment-1' });

    const { POST } = await import('@/app/api/horses/[id]/attachments/route');

    const form = new FormData();
    form.set('file', new File(['pdf-bytes'], 'chart.pdf', { type: 'application/pdf' }));
    form.set('description', 'Routine chart');
    form.set('uploadedById', 'spoofed-user');

    const request = new Request('http://localhost:3000/api/horses/horse-1/attachments', {
      method: 'POST',
      body: form,
    }) as NextRequest;

    const response = await POST(request, { params: Promise.resolve({ id: 'horse-1' }) });

    expect(response.status).toBe(201);
    expect(uploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        horseId: 'horse-1',
        uploadedById: 'session-user',
      }),
    );
  });
});
