import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

/**
 * GET /api/setup
 * Demo-only helper that runs `prisma migrate deploy` + the demo seed.
 * Permanently blocked outside demo mode: this endpoint executes child
 * processes and must never be reachable on a live production deploy.
 */
export async function GET() {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Only available in demo mode' }, { status: 403 });
  }

  const results: { step: string; status: string; output?: string; error?: string }[] = [];

  try {
    const migrateOutput = execSync('npx prisma migrate deploy', {
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env, PATH: process.env.PATH },
      cwd: process.cwd(),
    });
    results.push({ step: 'migrate', status: 'success', output: migrateOutput.trim() });
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    results.push({ step: 'migrate', status: 'error', error: err.stderr || err.message || 'Unknown error' });
  }

  try {
    const seedOutput = execSync('npx tsx prisma/seed-demo.ts', {
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env, PATH: process.env.PATH },
      cwd: process.cwd(),
    });
    results.push({ step: 'seed', status: 'success', output: seedOutput.trim() });
  } catch {
    // Seed might fail if data exists — that's OK.
    results.push({ step: 'seed', status: 'warning', error: 'Seed may have already been applied' });
  }

  const allOk = results.every((r) => r.status === 'success' || r.status === 'warning');

  return NextResponse.json({
    status: allOk ? 'success' : 'error',
    message: allOk ? 'Database is ready! Go to /en/dashboard' : 'Some steps failed - see details',
    results,
  });
}
