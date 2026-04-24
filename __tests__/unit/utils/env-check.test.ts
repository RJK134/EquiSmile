/**
 * Phase 7 Tests — Environment validation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkEnvironment } from '@/lib/utils/env-check';

describe('checkEnvironment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function stubAuth() {
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('AUTH_GITHUB_ID', 'test-id');
    vi.stubEnv('AUTH_GITHUB_SECRET', 'test-secret');
    vi.stubEnv('ALLOWED_GITHUB_LOGINS', 'tester');
  }

  function stubEmailProvider() {
    vi.stubEnv('AUTH_EMAIL_ENABLED', 'true');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_USER', 'user@example.com');
    vi.stubEnv('SMTP_PASSWORD', 'secret');
  }

  it('should pass when DATABASE_URL and GitHub auth are set', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    stubAuth();
    const result = checkEnvironment();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when DATABASE_URL is missing', () => {
    vi.stubEnv('DATABASE_URL', '');
    stubAuth();
    const result = checkEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
  });

  it('should fail when auth vars are missing in non-demo mode', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    vi.stubEnv('DEMO_MODE', 'false');
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('ALLOWED_GITHUB_LOGINS', '');
    vi.stubEnv('AUTH_GITHUB_ID', '');
    vi.stubEnv('AUTH_GITHUB_SECRET', '');
    vi.stubEnv('AUTH_EMAIL_ENABLED', 'false');
    vi.stubEnv('SMTP_HOST', '');
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASSWORD', '');
    const result = checkEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('AUTH_SECRET'))).toBe(true);
  });

  it('should pass without auth vars in demo mode', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    vi.stubEnv('DEMO_MODE', 'true');
    const result = checkEnvironment();
    expect(result.valid).toBe(true);
  });

  it('should fail when no auth provider is configured (no GitHub, no Email)', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('ALLOWED_GITHUB_LOGINS', 'tester');
    const result = checkEnvironment();
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('At least one auth provider')),
    ).toBe(true);
  });

  it('should pass when only Email magic-link provider is configured', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('ALLOWED_GITHUB_LOGINS', 'vet@example.com');
    stubEmailProvider();
    const result = checkEnvironment();
    expect(result.valid).toBe(true);
  });

  it('should fail when AUTH_EMAIL_ENABLED=true but SMTP is incomplete', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    stubAuth();
    vi.stubEnv('AUTH_EMAIL_ENABLED', 'true');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    // SMTP_USER and SMTP_PASSWORD missing
    const result = checkEnvironment();
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('AUTH_EMAIL_ENABLED=true but SMTP')),
    ).toBe(true);
  });

  it('should warn on partially configured WhatsApp', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    stubAuth();
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123');
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', '');
    vi.stubEnv('WHATSAPP_VERIFY_TOKEN', '');

    const result = checkEnvironment();
    expect(result.warnings.some((w) => w.includes('WhatsApp'))).toBe(true);
  });

  it('should warn on invalid SMTP_PORT', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    stubAuth();
    vi.stubEnv('SMTP_PORT', '99999');

    const result = checkEnvironment();
    expect(result.warnings.some((w) => w.includes('SMTP_PORT'))).toBe(true);
  });
});
