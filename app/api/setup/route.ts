import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { requireActorWithRole } from '@/lib/auth/api';
import { securityAuditService } from '@/lib/services/security-audit.service';

export async function GET() {
  const actor = await requireActorWithRole(['admin']);
  // Only available in demo mode for safety
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Only available in demo mode' }, { status: 403 });
  }

  const results: { step: string; status: string; output?: string; error?: string }[] = [];

  // Step 1: Run prisma migrate deploy
  try {
    const migrateOutput = execSync('npx prisma migrate deploy', {
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, PATH: process.env.PATH },
      cwd: process.cwd(),
    });
    results.push({ step: 'migrate', status: 'success', output: migrateOutput.trim() });
  } catch (e: unknown) {
    const error = e as { stderr?: string; message?: string };
    results.push({ step: 'migrate', status: 'error', error: error.stderr || error.message || 'Unknown error' });
  }

  // Step 2: Run demo seed
  try {
    const seedOutput = execSync('npx tsx prisma/seed-demo.ts', {
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, PATH: process.env.PATH },
      cwd: process.cwd(),
    });
    results.push({ step: 'seed', status: 'success', output: seedOutput.trim() });
  } catch {
    // Seed might fail if data exists - that's ok
    results.push({ step: 'seed', status: 'warning', error: 'Seed may have already been applied' });
  }

  const allOk = results.every(r => r.status === 'success' || r.status === 'warning');

  await securityAuditService.log({
    action: 'setup.demo-bootstrap',
    entityType: 'system',
    actor,
    outcome: allOk ? 'SUCCESS' : 'FAILED',
    details: { results },
  });

  return NextResponse.json({
    status: allOk ? 'success' : 'error',
    message: allOk ? 'Database is ready! Go to /en/dashboard' : 'Some steps failed - see details',
    results,
  });
}
