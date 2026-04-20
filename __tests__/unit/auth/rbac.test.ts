import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({
  auth: authMock,
}));

import {
  ROLES,
  normaliseRole,
  hasRole,
  requireAuth,
  requireRole,
  authzErrorResponse,
  AuthzError,
  withRole,
} from '@/lib/auth/rbac';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('normaliseRole', () => {
  it('returns READONLY for null, undefined, blank, or unknown', () => {
    expect(normaliseRole(null)).toBe(ROLES.READONLY);
    expect(normaliseRole(undefined)).toBe(ROLES.READONLY);
    expect(normaliseRole('')).toBe(ROLES.READONLY);
    expect(normaliseRole('fleet-admin')).toBe(ROLES.READONLY);
  });

  it('lowercases and trims the input', () => {
    expect(normaliseRole('ADMIN')).toBe(ROLES.ADMIN);
    expect(normaliseRole('  Vet  ')).toBe(ROLES.VET);
  });

  it('maps known role strings', () => {
    expect(normaliseRole('admin')).toBe(ROLES.ADMIN);
    expect(normaliseRole('vet')).toBe(ROLES.VET);
    expect(normaliseRole('nurse')).toBe(ROLES.NURSE);
    expect(normaliseRole('readonly')).toBe(ROLES.READONLY);
  });
});

describe('hasRole', () => {
  it('is a non-strict hierarchy', () => {
    expect(hasRole(ROLES.ADMIN, ROLES.VET)).toBe(true);
    expect(hasRole(ROLES.ADMIN, ROLES.ADMIN)).toBe(true);
    expect(hasRole(ROLES.VET, ROLES.ADMIN)).toBe(false);
    expect(hasRole(ROLES.VET, ROLES.NURSE)).toBe(true);
    expect(hasRole(ROLES.NURSE, ROLES.VET)).toBe(false);
    expect(hasRole(ROLES.READONLY, ROLES.NURSE)).toBe(false);
    expect(hasRole(ROLES.READONLY, ROLES.READONLY)).toBe(true);
  });
});

describe('requireAuth', () => {
  it('throws 401 when there is no session', async () => {
    authMock.mockResolvedValue(null);
    await expect(requireAuth()).rejects.toMatchObject({ status: 401 });
  });

  it('returns a normalised subject for an authenticated session', async () => {
    authMock.mockResolvedValue({
      user: {
        id: 'u1',
        email: 'rk@example.com',
        githubLogin: 'rjk134',
        role: 'ADMIN',
      },
    });
    const subject = await requireAuth();
    expect(subject.role).toBe(ROLES.ADMIN);
    expect(subject.actorLabel).toBe('rjk134');
  });

  it('treats an unknown role as READONLY (deny by default)', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u2', email: null, githubLogin: 'someone', role: 'wibble' },
    });
    const subject = await requireAuth();
    expect(subject.role).toBe(ROLES.READONLY);
  });
});

describe('requireRole', () => {
  it('throws 403 when the user has a lower role', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u1', email: null, githubLogin: 'n', role: 'nurse' },
    });
    await expect(requireRole(ROLES.ADMIN)).rejects.toMatchObject({ status: 403 });
  });

  it('succeeds when the user has a higher role', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u1', email: null, githubLogin: 'admin', role: 'admin' },
    });
    const subject = await requireRole(ROLES.VET);
    expect(subject.actorLabel).toBe('admin');
  });

  it('succeeds when the user has exactly the required role', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u1', email: null, githubLogin: 'v', role: 'vet' },
    });
    const subject = await requireRole(ROLES.VET);
    expect(subject.role).toBe(ROLES.VET);
  });
});

describe('authzErrorResponse', () => {
  it('returns a JSON error with the AuthzError status', () => {
    const response = authzErrorResponse(new AuthzError('nope', 403));
    expect(response.status).toBe(403);
  });

  it('re-throws other errors', () => {
    expect(() => authzErrorResponse(new Error('other'))).toThrow('other');
  });
});

describe('withRole', () => {
  it('calls the handler when authz passes', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u1', email: null, githubLogin: 'admin', role: 'admin' },
    });
    const handler = vi.fn(async () => ({ status: 'ok' }));
    const wrapped = withRole(ROLES.VET, handler);
    const result = await wrapped();
    expect(result).toEqual({ status: 'ok' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns a 403 response when authz fails', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u1', email: null, githubLogin: 'n', role: 'nurse' },
    });
    const handler = vi.fn();
    const wrapped = withRole(ROLES.ADMIN, handler);
    const result = await wrapped();
    expect(handler).not.toHaveBeenCalled();
    expect((result as { status: number }).status).toBe(403);
  });
});
