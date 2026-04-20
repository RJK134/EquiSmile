/**
 * Phase 8 Tests — Environment validation script.
 *
 * Tests the env-check utility that underpins the validation script,
 * covering all check categories: required vars, optional groups,
 * URL validation, and port validation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkEnvironment } from '@/lib/utils/env-check';

describe('validate-environment checks', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('required variables', () => {
    it('passes when all required variables are set', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      vi.stubEnv('AUTH_GITHUB_ID', 'test-id');
      vi.stubEnv('AUTH_GITHUB_SECRET', 'test-secret');
      vi.stubEnv('ALLOWED_GITHUB_LOGINS', 'tester');
      const result = checkEnvironment();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when auth vars are missing outside demo mode', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('DEMO_MODE', 'false');
      const result = checkEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('AUTH_SECRET'));
    });

    it('fails when DATABASE_URL is missing', () => {
      vi.stubEnv('DATABASE_URL', '');
      const result = checkEnvironment();
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('DATABASE_URL'),
      );
    });

    it('fails when DATABASE_URL is not a postgres URL', () => {
      vi.stubEnv('DATABASE_URL', 'mysql://user:pass@localhost:3306/db');
      const result = checkEnvironment();
      expect(result.errors).toContainEqual(
        expect.stringContaining('PostgreSQL'),
      );
    });
  });

  describe('URL validation', () => {
    it('accepts valid NEXT_PUBLIC_APP_URL', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
      const result = checkEnvironment();
      expect(result.errors.filter((e) => e.includes('APP_URL'))).toHaveLength(0);
    });

    it('errors on invalid NEXT_PUBLIC_APP_URL', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('NEXT_PUBLIC_APP_URL', 'not-a-url');
      const result = checkEnvironment();
      expect(result.errors).toContainEqual(
        expect.stringContaining('NEXT_PUBLIC_APP_URL'),
      );
    });
  });

  describe('optional groups', () => {
    it('warns when WhatsApp is partially configured', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123');
      vi.stubEnv('WHATSAPP_ACCESS_TOKEN', '');
      vi.stubEnv('WHATSAPP_VERIFY_TOKEN', '');
      const result = checkEnvironment();
      expect(result.warnings).toContainEqual(
        expect.stringContaining('WhatsApp'),
      );
    });

    it('warns when SMTP is not configured', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('SMTP_HOST', '');
      vi.stubEnv('SMTP_USER', '');
      vi.stubEnv('SMTP_PASSWORD', '');
      const result = checkEnvironment();
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Email/SMTP'),
      );
    });

    it('warns when Google Maps is not configured', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
      const result = checkEnvironment();
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Google Maps'),
      );
    });

    it('warns when n8n API key is not configured', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('N8N_API_KEY', '');
      const result = checkEnvironment();
      expect(result.warnings).toContainEqual(
        expect.stringContaining('n8n'),
      );
    });
  });

  describe('port validation', () => {
    it('warns on invalid SMTP_PORT', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('SMTP_PORT', '99999');
      const result = checkEnvironment();
      expect(result.warnings).toContainEqual(
        expect.stringContaining('SMTP_PORT'),
      );
    });

    it('warns on invalid N8N_PORT', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('N8N_PORT', '-1');
      const result = checkEnvironment();
      expect(result.warnings).toContainEqual(
        expect.stringContaining('N8N_PORT'),
      );
    });

    it('does not warn on valid ports', () => {
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db');
      vi.stubEnv('SMTP_PORT', '587');
      vi.stubEnv('N8N_PORT', '5678');
      const result = checkEnvironment();
      expect(result.warnings.filter((w) => w.includes('PORT'))).toHaveLength(0);
    });
  });
});
