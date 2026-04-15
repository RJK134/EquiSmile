import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // English-speaking customer
  const customerEn = await prisma.customer.upsert({
    where: { email: 'sarah.jones@example.co.uk' },
    update: {},
    create: {
      id: 'seed-customer-en',
      fullName: 'Sarah Jones',
      mobilePhone: '+447700900001',
      email: 'sarah.jones@example.co.uk',
      preferredChannel: 'WHATSAPP',
      preferredLanguage: 'en',
      notes: 'Regular client, 3 horses at Oakfield Stables.',
    },
  });
  console.log(`  Customer (EN): ${customerEn.fullName}`);

  // French-speaking customer
  const customerFr = await prisma.customer.upsert({
    where: { email: 'pierre.dupont@example.fr' },
    update: {},
    create: {
      id: 'seed-customer-fr',
      fullName: 'Pierre Dupont',
      mobilePhone: '+33612345678',
      email: 'pierre.dupont@example.fr',
      preferredChannel: 'EMAIL',
      preferredLanguage: 'fr',
      notes: 'Client francophone, yard near Calais.',
    },
  });
  console.log(`  Customer (FR): ${customerFr.fullName}`);

  // Yard for English customer
  const yardEn = await prisma.yard.upsert({
    where: { id: 'seed-yard-en' },
    update: {},
    create: {
      id: 'seed-yard-en',
      customerId: customerEn.id,
      yardName: 'Oakfield Stables',
      addressLine1: '12 Oakfield Lane',
      town: 'Newmarket',
      county: 'Suffolk',
      postcode: 'CB8 9AA',
      latitude: 52.2452,
      longitude: 0.4048,
      accessNotes: 'Enter via the second gate on the left.',
      areaLabel: 'Newmarket',
    },
  });
  console.log(`  Yard (EN): ${yardEn.yardName}`);

  // Yard for French customer
  const yardFr = await prisma.yard.upsert({
    where: { id: 'seed-yard-fr' },
    update: {},
    create: {
      id: 'seed-yard-fr',
      customerId: customerFr.id,
      yardName: 'Haras de la Baie',
      addressLine1: '8 Chemin du Haras',
      town: 'Calais',
      county: 'Pas-de-Calais',
      postcode: '62100',
      latitude: 50.9513,
      longitude: 1.8587,
      accessNotes: 'Sonnez au portail principal.',
      areaLabel: 'Calais',
    },
  });
  console.log(`  Yard (FR): ${yardFr.yardName}`);

  // Horses for English customer
  const horseNames = ['Bramble', 'Shadow', 'Fern'];
  for (const name of horseNames) {
    const horse = await prisma.horse.upsert({
      where: { id: `seed-horse-${name.toLowerCase()}` },
      update: {},
      create: {
        id: `seed-horse-${name.toLowerCase()}`,
        customerId: customerEn.id,
        primaryYardId: yardEn.id,
        horseName: name,
        age: name === 'Bramble' ? 12 : name === 'Shadow' ? 8 : 5,
        notes:
          name === 'Bramble' ? 'Needs sedation for dental work.' : undefined,
        dentalDueDate: new Date('2026-06-01'),
        active: true,
      },
    });
    console.log(`  Horse: ${horse.horseName}`);
  }

  // Horse for French customer
  const horseFr = await prisma.horse.upsert({
    where: { id: 'seed-horse-eclat' },
    update: {},
    create: {
      id: 'seed-horse-eclat',
      customerId: customerFr.id,
      primaryYardId: yardFr.id,
      horseName: 'Eclat',
      age: 6,
      dentalDueDate: new Date('2026-07-15'),
      active: true,
    },
  });
  console.log(`  Horse: ${horseFr.horseName}`);

  // Routine visit request
  const routineVisit = await prisma.visitRequest.upsert({
    where: { id: 'seed-visit-routine' },
    update: {},
    create: {
      id: 'seed-visit-routine',
      customerId: customerEn.id,
      yardId: yardEn.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
      clinicalFlags: [],
      horseCount: 3,
      specificHorses: ['Bramble', 'Shadow', 'Fern'],
      preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
      preferredTimeBand: 'AM',
      earliestBookDate: new Date('2026-05-01'),
      latestBookDate: new Date('2026-06-30'),
      planningStatus: 'UNTRIAGED',
      estimatedDurationMinutes: 120,
    },
  });
  console.log(`  Visit request (routine): ${routineVisit.id}`);

  // Urgent visit request
  const urgentVisit = await prisma.visitRequest.upsert({
    where: { id: 'seed-visit-urgent' },
    update: {},
    create: {
      id: 'seed-visit-urgent',
      customerId: customerFr.id,
      yardId: yardFr.id,
      requestType: 'URGENT_ISSUE',
      urgencyLevel: 'URGENT',
      clinicalFlags: ['swelling', 'not eating'],
      horseCount: 1,
      specificHorses: ['Eclat'],
      preferredDays: [],
      preferredTimeBand: 'ANY',
      needsMoreInfo: false,
      planningStatus: 'UNTRIAGED',
      estimatedDurationMinutes: 60,
    },
  });
  console.log(`  Visit request (urgent): ${urgentVisit.id}`);

  console.log('Seeding complete.');
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
