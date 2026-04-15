/**
 * Phase 7 Tests — Environment validation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkEnvironment } from '@/lib/utils/env-check';

describe('checkEnvironment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should pass when DATABASE_URL is set', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    const result = checkEnvironment();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when DATABASE_URL is missing', () => {
    vi.stubEnv('DATABASE_URL', '');
    const result = checkEnvironment();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
  });

  it('should warn on partially configured WhatsApp', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123');
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', '');
    vi.stubEnv('WHATSAPP_VERIFY_TOKEN', '');

    const result = checkEnvironment();
    expect(result.warnings.some((w) => w.includes('WhatsApp'))).toBe(true);
  });

  it('should warn on invalid SMTP_PORT', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
    vi.stubEnv('SMTP_PORT', '99999');

    const result = checkEnvironment();
    expect(result.warnings.some((w) => w.includes('SMTP_PORT'))).toBe(true);
  });
});
