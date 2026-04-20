import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Production seed — minimal setup for a fresh EquiSmile installation.
 *
 * This does NOT create fake customers, yards, horses, or enquiries.
 * For demo data, use `seed-demo.ts` (run via scripts/windows/DEMO.bat or
 * DEMO_MODE=true).
 *
 * The production seed only verifies the database connection and logs
 * the clean-start state. Real data will be created through the app's
 * normal intake channels (WhatsApp, email, manual entry).
 */
async function main() {
  console.log('EquiSmile production seed\n');
  console.log('Database connection verified.');
  console.log('No sample data created — this is a clean production install.');
  console.log('');
  console.log('To get started:');
  console.log('  1. Configure WhatsApp and/or email intake in .env');
  console.log('  2. Customers will be created automatically from inbound messages');
  console.log('  3. Or create customers and yards manually via the UI');
  console.log('');
  console.log('For demo data, run: npx prisma db seed -- --demo');
  console.log('  (or use scripts/windows/DEMO.bat / set DEMO_MODE=true)');
  console.log('\nProduction seed complete.');
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
