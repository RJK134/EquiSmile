import { describe, it, expect } from 'vitest';
import { isSafeCallbackUrl, safeCallbackUrl } from '@/lib/auth/redirect';

describe('isSafeCallbackUrl', () => {
  it('accepts simple same-origin paths', () => {
    expect(isSafeCallbackUrl('/')).toBe(true);
    expect(isSafeCallbackUrl('/en/dashboard')).toBe(true);
    expect(isSafeCallbackUrl('/en/customers/123')).toBe(true);
    expect(isSafeCallbackUrl('/en/route-runs?date=2026-05-01')).toBe(true);
  });

  it('rejects absolute URLs', () => {
    expect(isSafeCallbackUrl('https://evil.example/')).toBe(false);
    expect(isSafeCallbackUrl('http://localhost/admin')).toBe(false);
  });

  it('rejects protocol-relative URLs', () => {
    expect(isSafeCallbackUrl('//evil.example/')).toBe(false);
    expect(isSafeCallbackUrl('//evil.example/en/login')).toBe(false);
    expect(isSafeCallbackUrl('/\\evil.example')).toBe(false);
  });

  it('rejects percent-encoded protocol-relative URLs (decoded once)', () => {
    expect(isSafeCallbackUrl('%2F%2Fevil.example')).toBe(false);
    expect(isSafeCallbackUrl('%2f%2fevil.example/')).toBe(false);
    expect(isSafeCallbackUrl('/%2Fevil.example')).toBe(false);
  });

  it('rejects URLs with CR/LF/NUL (header injection)', () => {
    expect(isSafeCallbackUrl('/en/dashboard\r\nSet-Cookie: x=y')).toBe(false);
    expect(isSafeCallbackUrl('/en/dashboard\nheader')).toBe(false);
    expect(isSafeCallbackUrl('/en/\u0000/')).toBe(false);
  });

  it('rejects javascript: and data: schemes even with leading /', () => {
    expect(isSafeCallbackUrl('/javascript:alert(1)')).toBe(false);
    expect(isSafeCallbackUrl('/data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects path traversal segments', () => {
    expect(isSafeCallbackUrl('/../admin')).toBe(false);
    expect(isSafeCallbackUrl('/en/../admin')).toBe(false);
    expect(isSafeCallbackUrl('/en/customers/..')).toBe(false);
  });

  it('rejects empty and oversized values', () => {
    expect(isSafeCallbackUrl('')).toBe(false);
    expect(isSafeCallbackUrl(null)).toBe(false);
    expect(isSafeCallbackUrl(undefined)).toBe(false);
    expect(isSafeCallbackUrl('/' + 'a'.repeat(3000))).toBe(false);
  });

  it('rejects bare strings that do not begin with /', () => {
    expect(isSafeCallbackUrl('en/dashboard')).toBe(false);
    expect(isSafeCallbackUrl('evil.example/')).toBe(false);
  });
});

describe('safeCallbackUrl', () => {
  it('returns the URL when safe', () => {
    expect(safeCallbackUrl('/en/dashboard')).toBe('/en/dashboard');
  });

  it('returns the fallback when unsafe', () => {
    expect(safeCallbackUrl('https://evil.example/', '/')).toBe('/');
    expect(safeCallbackUrl('//evil.example/', '/en')).toBe('/en');
    expect(safeCallbackUrl(undefined, '/en')).toBe('/en');
  });

  it('defaults the fallback to /', () => {
    expect(safeCallbackUrl('//evil.example/')).toBe('/');
  });
});
