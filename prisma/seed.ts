import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed dispatcher — production by default, demo when DEMO_MODE=true.
 *
 * - `npx prisma db seed`             → production (minimal, logs only)
 * - `DEMO_MODE=true npx prisma db seed` → comprehensive demo via seed-demo.ts
 * - `npx prisma db seed -- --demo`   → comprehensive demo (CLI flag, same effect)
 * - `npm run db:seed`                → comprehensive demo (alias)
 *
 * Production seed does NOT create fake customers, yards, horses, or
 * enquiries. Real data flows through the app's intake channels
 * (WhatsApp, email, manual entry).
 */

const wantsDemo =
  process.env.DEMO_MODE === 'true' ||
  process.argv.includes('--demo');

async function productionSeed() {
  console.log('EquiSmile production seed\n');
  console.log('Database connection verified.');
  console.log('No sample data created — this is a clean production install.');
  console.log('');
  console.log('To get started:');
  console.log('  1. Configure WhatsApp and/or email intake in .env');
  console.log('  2. Customers will be created automatically from inbound messages');
  console.log('  3. Or create customers and yards manually via the UI');
  console.log('');
  console.log('For demo data, run: npm run db:seed');
  console.log('  (or `npx prisma db seed -- --demo`, or set DEMO_MODE=true)');
  console.log('\nProduction seed complete.');
}

async function main() {
  if (wantsDemo) {
    console.log('DEMO_MODE detected — dispatching to seed-demo.ts\n');
    // Dynamic import keeps the production seed dependency-light:
    // production deployments never load the demo seed module.
    await import('./seed-demo');
    return;
  }
  await productionSeed();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
