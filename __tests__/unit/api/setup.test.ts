import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ORIGINAL_DEMO_MODE = process.env.DEMO_MODE;

describe('GET /api/setup', () => {
  beforeEach(() => {
    delete process.env.DEMO_MODE;
  });

  afterEach(() => {
    if (ORIGINAL_DEMO_MODE === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = ORIGINAL_DEMO_MODE;
  });

  it('returns 403 when DEMO_MODE is unset (defence-in-depth gate)', async () => {
    const { GET } = await import('@/app/api/setup/route');
    const response = await GET();
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Not available in production');
  });

  it('returns 403 when DEMO_MODE is "false"', async () => {
    process.env.DEMO_MODE = 'false';
    const { GET } = await import('@/app/api/setup/route');
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it('returns 410 Gone with operator guidance when DEMO_MODE=true', async () => {
    // The route used to run `execSync('npx prisma migrate deploy')`
    // here. It now refuses to do that and points the operator at the
    // supported migration paths.
    process.env.DEMO_MODE = 'true';
    const { GET } = await import('@/app/api/setup/route');
    const response = await GET();

    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.status).toBe('gone');
    expect(body.supportedPaths.compose).toMatch(/docker compose up migrator/);
    expect(body.supportedPaths.local).toMatch(/prisma migrate deploy/);
  });

  it('does NOT spawn child processes (the whole point of this slice)', async () => {
    // Static-analysis assertion: the route module must not import
    // node:child_process or invoke any process-spawning helper. If a
    // future change re-introduces it, this test fails and the
    // security fix has regressed.
    //
    // Comments are stripped before checking so the doc comment that
    // *describes* the old behaviour (mentioning `execSync` etc.)
    // doesn't trip the assertion.
    process.env.DEMO_MODE = 'true';
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const raw = readFileSync(
      resolve(__dirname, '../../..', 'app', 'api', 'setup', 'route.ts'),
      'utf-8',
    );
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/\/\/.*$/gm, ''); // line comments

    expect(code).not.toMatch(/from\s+['"]child_process['"]/);
    expect(code).not.toMatch(/from\s+['"]node:child_process['"]/);
    expect(code).not.toMatch(/require\s*\(\s*['"](?:node:)?child_process['"]/);
    // Function-call patterns (not bare-word) so we don't false-match
    // domain words like "executeSync" if someone introduces them.
    expect(code).not.toMatch(/\bexecSync\s*\(/);
    expect(code).not.toMatch(/\bexec\s*\(/);
    expect(code).not.toMatch(/\bspawn\s*\(/);
    expect(code).not.toMatch(/\bspawnSync\s*\(/);
    expect(code).not.toMatch(/\bfork\s*\(/);
  });

  it('emits Cache-Control: no-store so operators see fresh 410s while diagnosing', async () => {
    process.env.DEMO_MODE = 'true';
    const { GET } = await import('@/app/api/setup/route');
    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
