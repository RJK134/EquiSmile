/**
 * Coverage for POST /api/triage-ops/stock-reply (G-2b — Phase A.3 of the
 * May 2026 client user-story triage). Asserts the route validates the
 * template enum, gates on NURSE+, and surfaces the service result.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const requireRoleMock = vi.hoisted(() => vi.fn());
const sendStockReplyMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/lib/services/stock-reply.service', () => ({
  stockReplyService: { sendStockReply: sendStockReplyMock },
}));

function signedInAs(role: 'admin' | 'vet' | 'nurse' | 'readonly') {
  requireRoleMock.mockResolvedValue({
    id: 'u1',
    email: 'vet@example.test',
    githubLogin: 'vet1',
    role,
    actorLabel: 'vet1',
  });
}

describe('POST /api/triage-ops/stock-reply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and forwards the result for a valid request', async () => {
    signedInAs('nurse');
    sendStockReplyMock.mockResolvedValue({
      sent: true,
      channel: 'WHATSAPP',
      templateName: 'faq_acknowledge_v1',
      enquiryId: 'enq-1',
    });

    const { POST } = await import('@/app/api/triage-ops/stock-reply/route');
    const request = new NextRequest('http://localhost:3000/api/triage-ops/stock-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitRequestId: 'vr-1', template: 'faq_acknowledge_v1' }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sent).toBe(true);
    expect(sendStockReplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visitRequestId: 'vr-1',
        template: 'faq_acknowledge_v1',
        actor: expect.objectContaining({ id: 'u1', role: 'nurse' }),
      }),
    );
  });

  it('returns 400 for an unknown template name', async () => {
    signedInAs('nurse');

    const { POST } = await import('@/app/api/triage-ops/stock-reply/route');
    const request = new NextRequest('http://localhost:3000/api/triage-ops/stock-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitRequestId: 'vr-1', template: 'arbitrary_free_text' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(sendStockReplyMock).not.toHaveBeenCalled();
  });

  it('returns 500 with the service error when the send fails', async () => {
    signedInAs('vet');
    sendStockReplyMock.mockResolvedValue({
      sent: false,
      channel: 'NONE',
      templateName: 'faq_request_info_v1',
      enquiryId: null,
      error: 'Customer has no contact channels',
    });

    const { POST } = await import('@/app/api/triage-ops/stock-reply/route');
    const request = new NextRequest('http://localhost:3000/api/triage-ops/stock-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitRequestId: 'vr-1', template: 'faq_request_info_v1' }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Customer has no contact channels');
  });

  it('rejects a READONLY user with 403', async () => {
    const { AuthzError } = await import('@/lib/auth/rbac');
    requireRoleMock.mockRejectedValueOnce(new AuthzError('Insufficient role', 403));

    const { POST } = await import('@/app/api/triage-ops/stock-reply/route');
    const request = new NextRequest('http://localhost:3000/api/triage-ops/stock-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitRequestId: 'vr-1', template: 'faq_acknowledge_v1' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(sendStockReplyMock).not.toHaveBeenCalled();
  });
});
