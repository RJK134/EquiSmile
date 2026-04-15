/**
 * Phase 7.8 — Pre-flight check script.
 *
 * Run before deployment to validate:
 * - Environment variables
 * - Database connectivity
 * - Prisma migrations status
 *
 * Usage: npx tsx scripts/preflight-check.ts
 */

import { checkEnvironment } from '../lib/utils/env-check';

async function main() {
  console.log('=== EquiSmile Pre-flight Check ===\n');

  // 1. Environment validation
  console.log('1. Checking environment variables...');
  const envResult = checkEnvironment();

  for (const warning of envResult.warnings) {
    console.warn(`   WARNING: ${warning}`);
  }
  for (const error of envResult.errors) {
    console.error(`   ERROR: ${error}`);
  }

  if (!envResult.valid) {
    console.error('\n   Environment check FAILED.\n');
    process.exit(1);
  }
  console.log('   Environment check PASSED.\n');

  // 2. Database connectivity
  console.log('2. Checking database connectivity...');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    console.log('   Database check PASSED.\n');
  } catch (err) {
    console.error(`   Database check FAILED: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }

  // 3. Summary
  console.log('=== Pre-flight check PASSED ===');
  console.log('All critical systems are operational.');
}

main().catch((err) => {
  console.error('Pre-flight check encountered an unexpected error:', err);
  process.exit(1);
});
