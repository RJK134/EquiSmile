import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import {
  verifyWhatsAppSignature,
  verifyN8nApiKey,
  verifyWhatsAppVerifyToken,
  constantTimeStringEquals,
  requireN8nApiKey,
} from '@/lib/utils/signature';

describe('verifyWhatsAppSignature', () => {
  const appSecret = 'test-app-secret';

  function generateSignature(payload: string): string {
    return 'sha256=' + createHmac('sha256', appSecret).update(payload).digest('hex');
  }

  it('verifies valid signature', () => {
    const payload = '{"test":"data"}';
    const signature = generateSignature(payload);
    expect(verifyWhatsAppSignature(payload, signature, appSecret)).toBe(true);
  });

  it('rejects invalid signature', () => {
    const payload = '{"test":"data"}';
    expect(verifyWhatsAppSignature(payload, 'sha256=invalid', appSecret)).toBe(false);
  });

  it('rejects empty signature', () => {
    expect(verifyWhatsAppSignature('{}', '', appSecret)).toBe(false);
  });

  it('rejects empty secret', () => {
    expect(verifyWhatsAppSignature('{}', 'sha256=something', '')).toBe(false);
  });

  it('rejects tampered payload', () => {
    const payload = '{"test":"data"}';
    const signature = generateSignature(payload);
    expect(verifyWhatsAppSignature('{"test":"tampered"}', signature, appSecret)).toBe(false);
  });
});

describe('verifyN8nApiKey', () => {
  const expectedKey = 'my-secret-api-key';

  it('verifies valid Bearer token', () => {
    expect(verifyN8nApiKey(`Bearer ${expectedKey}`, expectedKey)).toBe(true);
  });

  it('rejects wrong key', () => {
    expect(verifyN8nApiKey('Bearer wrong-key', expectedKey)).toBe(false);
  });

  it('rejects missing header', () => {
    expect(verifyN8nApiKey(null, expectedKey)).toBe(false);
  });

  it('rejects non-Bearer auth', () => {
    expect(verifyN8nApiKey(`Basic ${expectedKey}`, expectedKey)).toBe(false);
  });

  it('rejects empty expected key', () => {
    expect(verifyN8nApiKey('Bearer test', '')).toBe(false);
  });
});

describe('verifyWhatsAppVerifyToken', () => {
  it('returns true for equal tokens', () => {
    expect(verifyWhatsAppVerifyToken('my-token', 'my-token')).toBe(true);
  });

  it('returns false for different tokens of equal length', () => {
    expect(verifyWhatsAppVerifyToken('my-token', 'my-tokez')).toBe(false);
  });

  it('returns false for different-length tokens without throwing', () => {
    expect(verifyWhatsAppVerifyToken('short', 'way-longer-token')).toBe(false);
  });

  it('returns false for null/undefined/empty inputs', () => {
    expect(verifyWhatsAppVerifyToken(null, 'expected')).toBe(false);
    expect(verifyWhatsAppVerifyToken('received', undefined)).toBe(false);
    expect(verifyWhatsAppVerifyToken('', 'expected')).toBe(false);
  });
});

describe('requireN8nApiKey (fail-closed gate)', () => {
  it('accepts anonymously in demo mode even with no key configured', () => {
    const r = requireN8nApiKey({ authHeader: null, expectedKey: '', demoMode: true });
    expect(r.ok).toBe(true);
  });

  it('fails closed in production when no key is configured (500) and response does not disclose config state', async () => {
    const r = requireN8nApiKey({ authHeader: 'Bearer anything', expectedKey: '', demoMode: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(500);
      const body = await r.response.json();
      // Generic message — must NOT mention the env var name or the word
      // "misconfiguration" so an anonymous probe can't fingerprint us.
      expect(body.error).toBe('Internal server error');
      expect(body.error).not.toMatch(/N8N_API_KEY/i);
      expect(body.error).not.toMatch(/misconfiguration/i);
    }
  });

  it('returns 401 when key is configured but header is wrong', async () => {
    const r = requireN8nApiKey({ authHeader: 'Bearer wrong', expectedKey: 'good-key', demoMode: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it('returns 401 when key is configured but no header is sent', async () => {
    const r = requireN8nApiKey({ authHeader: null, expectedKey: 'good-key', demoMode: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it('accepts a matching Bearer key even outside demo mode', () => {
    const r = requireN8nApiKey({
      authHeader: 'Bearer good-key',
      expectedKey: 'good-key',
      demoMode: false,
    });
    expect(r.ok).toBe(true);
  });

  it('still enforces the key in demo mode when one is configured', async () => {
    const r = requireN8nApiKey({ authHeader: 'Bearer wrong', expectedKey: 'good-key', demoMode: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });
});

describe('constantTimeStringEquals', () => {
  it('handles unicode without throwing', () => {
    expect(constantTimeStringEquals('café', 'café')).toBe(true);
    expect(constantTimeStringEquals('café', 'cafe')).toBe(false);
  });

  it('returns false for unequal-length strings', () => {
    expect(constantTimeStringEquals('abc', 'abcd')).toBe(false);
  });
});
