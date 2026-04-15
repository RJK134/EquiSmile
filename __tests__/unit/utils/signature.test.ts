import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verifyWhatsAppSignature, verifyN8nApiKey } from '@/lib/utils/signature';

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
