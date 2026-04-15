import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

describe('env validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('validates successfully with required DATABASE_URL', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    // Re-import to trigger validation with new env
    const { env } = await import('@/lib/env');
    expect(env.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/test');
  });

  it('applies defaults for optional variables', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    const { env } = await import('@/lib/env');
    expect(env.N8N_PORT).toBe('5678');
    expect(env.N8N_PROTOCOL).toBe('http');
    expect(env.N8N_HOST).toBe('localhost');
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
    expect(env.NEXT_PUBLIC_DEFAULT_LOCALE).toBe('en');
  });

  it('throws when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;

    await expect(import('@/lib/env')).rejects.toThrow(
      'Environment variable validation failed'
    );
  });

  it('getMissingRequiredVars returns empty array when all present', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    const { getMissingRequiredVars } = await import('@/lib/env');
    expect(getMissingRequiredVars()).toEqual([]);
  });

  it('getMissingRequiredVars reports missing DATABASE_URL', async () => {
    // Set DATABASE_URL so module loads, then remove it to simulate runtime check
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    const { getMissingRequiredVars } = await import('@/lib/env');

    // Temporarily remove to test the checker
    delete process.env.DATABASE_URL;
    expect(getMissingRequiredVars()).toContain('DATABASE_URL');
  });

  it('getN8nBaseUrl constructs URL from env defaults', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    const { getN8nBaseUrl } = await import('@/lib/env');
    expect(getN8nBaseUrl()).toBe('http://localhost:5678');
  });

  it('getN8nBaseUrl uses custom values', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.N8N_PROTOCOL = 'https';
    process.env.N8N_HOST = 'n8n.example.com';
    process.env.N8N_PORT = '443';

    const { getN8nBaseUrl } = await import('@/lib/env');
    expect(getN8nBaseUrl()).toBe('https://n8n.example.com:443');
  });
});

describe('zod schema validation patterns', () => {
  it('rejects empty string for required fields', () => {
    const schema = z.object({
      DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    });
    const result = schema.safeParse({ DATABASE_URL: '' });
    expect(result.success).toBe(false);
  });

  it('accepts valid connection string', () => {
    const schema = z.object({
      DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    });
    const result = schema.safeParse({
      DATABASE_URL: 'postgresql://user:pass@host:5432/db',
    });
    expect(result.success).toBe(true);
  });
});
