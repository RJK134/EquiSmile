import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const requireRoleMock = vi.hoisted(() => vi.fn());
const staffFindByUserIdMock = vi.hoisted(() => vi.fn());
const attachmentUploadMock = vi.hoisted(() => vi.fn());

// Block the real `@/auth` import — it pulls in next-auth which in turn
// imports `next/server` via a path that vitest's SSR resolver can't handle.
vi.mock('@/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/auth/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/rbac')>('@/lib/auth/rbac');
  return {
    ...actual,
    requireRole: requireRoleMock,
  };
});

vi.mock('@/lib/repositories/staff.repository', () => ({
  staffRepository: {
    findByUserId: staffFindByUserIdMock,
  },
}));

vi.mock('@/lib/services/attachment.service', () => ({
  attachmentService: {
    upload: attachmentUploadMock,
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

import { POST } from '@/app/api/horses/[id]/attachments/route';

function buildMultipartRequest(formEntries: Array<[string, string | Blob]>): Request {
  const form = new FormData();
  for (const [k, v] of formEntries) form.append(k, v);
  return new Request('http://localhost/api/horses/h1/attachments', {
    method: 'POST',
    body: form,
  });
}

function pdfBlob(name = 'chart.pdf'): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: 'application/pdf' });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({
    id: 'user-id-1',
    email: 'vet@example.com',
    githubLogin: 'vet1',
    role: 'vet',
    actorLabel: 'vet1',
  });
  attachmentUploadMock.mockResolvedValue({ id: 'att-1' });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/horses/[id]/attachments — uploader attribution is session-derived', () => {
  it('resolves uploadedById via staffRepository.findByUserId(subject.id)', async () => {
    staffFindByUserIdMock.mockResolvedValue({ id: 'staff-1' });
    const req = buildMultipartRequest([['file', pdfBlob()]]);
    const context = { params: Promise.resolve({ id: 'h1' }) };

    await POST(req as unknown as Parameters<typeof POST>[0], context);

    expect(staffFindByUserIdMock).toHaveBeenCalledWith('user-id-1');
    expect(attachmentUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({ uploadedById: 'staff-1' }),
    );
  });

  it('ignores uploadedById supplied in the multipart form (no spoofing)', async () => {
    staffFindByUserIdMock.mockResolvedValue({ id: 'staff-1' });
    const req = buildMultipartRequest([
      ['file', pdfBlob()],
      ['uploadedById', 'evil-spoofed-staff-id'],
    ]);
    const context = { params: Promise.resolve({ id: 'h1' }) };

    await POST(req as unknown as Parameters<typeof POST>[0], context);

    // The attacker-supplied form value must be dropped entirely.
    const passed = attachmentUploadMock.mock.calls[0][0];
    expect(passed.uploadedById).toBe('staff-1');
    expect(passed.uploadedById).not.toBe('evil-spoofed-staff-id');
  });

  it('falls back to null when the signed-in user has no linked Staff row', async () => {
    staffFindByUserIdMock.mockResolvedValue(null);
    const req = buildMultipartRequest([
      ['file', pdfBlob()],
      ['uploadedById', 'attacker-supplied'],
    ]);
    const context = { params: Promise.resolve({ id: 'h1' }) };

    await POST(req as unknown as Parameters<typeof POST>[0], context);

    const passed = attachmentUploadMock.mock.calls[0][0];
    // null is the correct fallback — we never trust the form value.
    expect(passed.uploadedById).toBeNull();
  });

  it('preserves description passed in the form', async () => {
    staffFindByUserIdMock.mockResolvedValue({ id: 'staff-1' });
    const req = buildMultipartRequest([
      ['file', pdfBlob()],
      ['description', 'Routine dental chart'],
    ]);
    const context = { params: Promise.resolve({ id: 'h1' }) };

    await POST(req as unknown as Parameters<typeof POST>[0], context);

    expect(attachmentUploadMock.mock.calls[0][0].description).toBe('Routine dental chart');
  });
});
