import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...\n');

  // ─── Customers (5: 3 EN, 2 FR) ───────────────────────────────────────────

  const customerSarah = await prisma.customer.upsert({
    where: { email: 'sarah.jones@example.co.uk' },
    update: {},
    create: {
      id: 'seed-customer-sarah',
      fullName: 'Sarah Jones',
      mobilePhone: '+447700900001',
      email: 'sarah.jones@example.co.uk',
      preferredChannel: 'WHATSAPP',
      preferredLanguage: 'en',
      notes: 'Regular client, 3 horses at Oakfield Stables. Prefers morning visits.',
    },
  });
  console.log(`  Customer (EN): ${customerSarah.fullName}`);

  const customerPierre = await prisma.customer.upsert({
    where: { email: 'pierre.dupont@example.fr' },
    update: {},
    create: {
      id: 'seed-customer-pierre',
      fullName: 'Pierre Dupont',
      mobilePhone: '+33612345678',
      email: 'pierre.dupont@example.fr',
      preferredChannel: 'EMAIL',
      preferredLanguage: 'fr',
      notes: 'Client francophone, yard near Calais. Speaks limited English.',
    },
  });
  console.log(`  Customer (FR): ${customerPierre.fullName}`);

  const customerEmma = await prisma.customer.upsert({
    where: { email: 'emma.thompson@example.co.uk' },
    update: {},
    create: {
      id: 'seed-customer-emma',
      fullName: 'Emma Thompson',
      mobilePhone: '+447700900003',
      email: 'emma.thompson@example.co.uk',
      preferredChannel: 'WHATSAPP',
      preferredLanguage: 'en',
      notes: 'Runs a riding school. Has multiple yards across Cambridgeshire.',
    },
  });
  console.log(`  Customer (EN): ${customerEmma.fullName}`);

  const customerMarie = await prisma.customer.upsert({
    where: { email: 'marie.lefevre@example.fr' },
    update: {},
    create: {
      id: 'seed-customer-marie',
      fullName: 'Marie Lefevre',
      mobilePhone: '+33698765432',
      email: 'marie.lefevre@example.fr',
      preferredChannel: 'WHATSAPP',
      preferredLanguage: 'fr',
      notes: 'Éleveuse de chevaux de sport. Yard à Boulogne-sur-Mer.',
    },
  });
  console.log(`  Customer (FR): ${customerMarie.fullName}`);

  const customerJames = await prisma.customer.upsert({
    where: { email: 'james.wilson@example.co.uk' },
    update: {},
    create: {
      id: 'seed-customer-james',
      fullName: 'James Wilson',
      mobilePhone: '+447700900005',
      email: 'james.wilson@example.co.uk',
      preferredChannel: 'PHONE',
      preferredLanguage: 'en',
      notes: 'Retired farmer, 2 horses. Prefers phone calls. Hard of hearing.',
    },
  });
  console.log(`  Customer (EN): ${customerJames.fullName}`);

  // ─── Yards (8 across 3 postcode areas) ──────────────────────────────────

  // Newmarket area (CB8)
  const yardOakfield = await prisma.yard.upsert({
    where: { id: 'seed-yard-oakfield' },
    update: {},
    create: {
      id: 'seed-yard-oakfield',
      customerId: customerSarah.id,
      yardName: 'Oakfield Stables',
      addressLine1: '12 Oakfield Lane',
      town: 'Newmarket',
      county: 'Suffolk',
      postcode: 'CB8 9AA',
      latitude: 52.2452,
      longitude: 0.4048,
      accessNotes: 'Enter via the second gate on the left. Dogs on site.',
      areaLabel: 'Newmarket',
    },
  });
  console.log(`  Yard: ${yardOakfield.yardName} (${yardOakfield.postcode})`);

  const yardKingsway = await prisma.yard.upsert({
    where: { id: 'seed-yard-kingsway' },
    update: {},
    create: {
      id: 'seed-yard-kingsway',
      customerId: customerEmma.id,
      yardName: 'Kingsway Riding School',
      addressLine1: '45 Kingsway',
      town: 'Newmarket',
      county: 'Suffolk',
      postcode: 'CB8 7QJ',
      latitude: 52.2389,
      longitude: 0.3912,
      accessNotes: 'Main car park at front. Report to office on arrival.',
      areaLabel: 'Newmarket',
    },
  });
  console.log(`  Yard: ${yardKingsway.yardName} (${yardKingsway.postcode})`);

  const yardExning = await prisma.yard.upsert({
    where: { id: 'seed-yard-exning' },
    update: {},
    create: {
      id: 'seed-yard-exning',
      customerId: customerEmma.id,
      yardName: 'Exning Paddocks',
      addressLine1: '3 Church Road',
      town: 'Exning',
      county: 'Suffolk',
      postcode: 'CB8 7HE',
      latitude: 52.2628,
      longitude: 0.3695,
      accessNotes: 'Access via narrow lane. No turning space for large vehicles.',
      areaLabel: 'Newmarket',
    },
  });
  console.log(`  Yard: ${yardExning.yardName} (${yardExning.postcode})`);

  // Cambridge area (CB2)
  const yardMeadow = await prisma.yard.upsert({
    where: { id: 'seed-yard-meadow' },
    update: {},
    create: {
      id: 'seed-yard-meadow',
      customerId: customerEmma.id,
      yardName: 'Meadow Farm Livery',
      addressLine1: '15 Meadow Lane',
      town: 'Cambridge',
      county: 'Cambridgeshire',
      postcode: 'CB2 1TN',
      latitude: 52.1906,
      longitude: 0.1183,
      accessNotes: 'Blue gate at end of lane. Ring bell.',
      areaLabel: 'Cambridge',
    },
  });
  console.log(`  Yard: ${yardMeadow.yardName} (${yardMeadow.postcode})`);

  const yardWillow = await prisma.yard.upsert({
    where: { id: 'seed-yard-willow' },
    update: {},
    create: {
      id: 'seed-yard-willow',
      customerId: customerJames.id,
      yardName: 'Willow End Farm',
      addressLine1: '8 Willow Lane',
      town: 'Great Shelford',
      county: 'Cambridgeshire',
      postcode: 'CB22 5EY',
      latitude: 52.1501,
      longitude: 0.1366,
      accessNotes: 'Park on the grass verge. Horses in the back field.',
      areaLabel: 'Cambridge',
    },
  });
  console.log(`  Yard: ${yardWillow.yardName} (${yardWillow.postcode})`);

  // Cross-channel area (62 — Pas-de-Calais)
  const yardHaras = await prisma.yard.upsert({
    where: { id: 'seed-yard-haras' },
    update: {},
    create: {
      id: 'seed-yard-haras',
      customerId: customerPierre.id,
      yardName: 'Haras de la Baie',
      addressLine1: '8 Chemin du Haras',
      town: 'Calais',
      county: 'Pas-de-Calais',
      postcode: '62100',
      latitude: 50.9513,
      longitude: 1.8587,
      accessNotes: 'Sonnez au portail principal. Chien de garde en liberté.',
      areaLabel: 'Calais',
    },
  });
  console.log(`  Yard: ${yardHaras.yardName} (${yardHaras.postcode})`);

  const yardBoulogne = await prisma.yard.upsert({
    where: { id: 'seed-yard-boulogne' },
    update: {},
    create: {
      id: 'seed-yard-boulogne',
      customerId: customerMarie.id,
      yardName: 'Écurie Côte d\'Opale',
      addressLine1: '22 Route de Desvres',
      town: 'Boulogne-sur-Mer',
      county: 'Pas-de-Calais',
      postcode: '62200',
      latitude: 50.7264,
      longitude: 1.6147,
      accessNotes: 'Grande entrée côté route. Se garer devant le manège.',
      areaLabel: 'Boulogne',
    },
  });
  console.log(`  Yard: ${yardBoulogne.yardName} (${yardBoulogne.postcode})`);

  const yardMarquise = await prisma.yard.upsert({
    where: { id: 'seed-yard-marquise' },
    update: {},
    create: {
      id: 'seed-yard-marquise',
      customerId: customerMarie.id,
      yardName: 'Ferme Équestre de Marquise',
      addressLine1: '5 Rue du Moulin',
      town: 'Marquise',
      county: 'Pas-de-Calais',
      postcode: '62250',
      latitude: 50.8067,
      longitude: 1.7081,
      accessNotes: 'Portail automatique — code 4523. Chevaux au pré l\'après-midi.',
      areaLabel: 'Boulogne',
    },
  });
  console.log(`  Yard: ${yardMarquise.yardName} (${yardMarquise.postcode})`);

  // ─── Horses (15 across the yards) ────────────────────────────────────────

  const horsesData = [
    { id: 'seed-horse-bramble', name: 'Bramble', age: 12, customer: customerSarah, yard: yardOakfield, notes: 'Needs sedation for dental work. History of wolf tooth issues.', due: '2026-06-01' },
    { id: 'seed-horse-shadow', name: 'Shadow', age: 8, customer: customerSarah, yard: yardOakfield, notes: 'Calm temperament, good for dental work.', due: '2026-06-01' },
    { id: 'seed-horse-fern', name: 'Fern', age: 5, customer: customerSarah, yard: yardOakfield, notes: 'Young mare, first full dental exam due.', due: '2026-06-01' },
    { id: 'seed-horse-eclat', name: 'Éclat', age: 6, customer: customerPierre, yard: yardHaras, notes: 'Cheval de sport, sensible à la bouche.', due: '2026-07-15' },
    { id: 'seed-horse-tempest', name: 'Tempest', age: 14, customer: customerEmma, yard: yardKingsway, notes: 'Riding school horse, regular check required.', due: '2026-05-15' },
    { id: 'seed-horse-blaze', name: 'Blaze', age: 10, customer: customerEmma, yard: yardKingsway, notes: 'History of sharp enamel points.', due: '2026-05-15' },
    { id: 'seed-horse-mist', name: 'Mist', age: 7, customer: customerEmma, yard: yardExning, notes: 'Quiet mare, easy to handle.', due: '2026-06-20' },
    { id: 'seed-horse-thunder', name: 'Thunder', age: 16, customer: customerEmma, yard: yardExning, notes: 'Older gelding, check for periodontal disease.', due: '2026-06-20' },
    { id: 'seed-horse-luna', name: 'Luna', age: 4, customer: customerEmma, yard: yardMeadow, notes: 'First dental appointment. Owner nervous.', due: '2026-07-01' },
    { id: 'seed-horse-apollo', name: 'Apollo', age: 9, customer: customerEmma, yard: yardMeadow, notes: 'Competition horse, needs mouth guard check.', due: '2026-07-01' },
    { id: 'seed-horse-biscuit', name: 'Biscuit', age: 22, customer: customerJames, yard: yardWillow, notes: 'Very old gelding, limited dental work. Cushings disease.', due: '2026-05-20' },
    { id: 'seed-horse-pepper', name: 'Pepper', age: 18, customer: customerJames, yard: yardWillow, notes: 'Retired mare, yearly check.', due: '2026-05-20' },
    { id: 'seed-horse-orage', name: 'Orage', age: 5, customer: customerMarie, yard: yardBoulogne, notes: 'Jeune hongre, premier examen dentaire complet.', due: '2026-06-10' },
    { id: 'seed-horse-cerise', name: 'Cerise', age: 8, customer: customerMarie, yard: yardBoulogne, notes: 'Jument de compétition, vérification annuelle.', due: '2026-06-10' },
    { id: 'seed-horse-mistral', name: 'Mistral', age: 11, customer: customerMarie, yard: yardMarquise, notes: 'Hongre nerveux, nécessite un manipulateur expérimenté.', due: '2026-08-01' },
  ];

  for (const h of horsesData) {
    const horse = await prisma.horse.upsert({
      where: { id: h.id },
      update: {},
      create: {
        id: h.id,
        customerId: h.customer.id,
        primaryYardId: h.yard.id,
        horseName: h.name,
        age: h.age,
        notes: h.notes,
        dentalDueDate: new Date(h.due),
        active: true,
      },
    });
    console.log(`  Horse: ${horse.horseName} (age ${horse.age}) at ${h.yard.yardName}`);
  }

  // ─── Enquiries (10: mix of WhatsApp and Email, various states) ───────────

  const enquiry1 = await prisma.enquiry.upsert({
    where: { id: 'seed-enquiry-01' },
    update: {},
    create: {
      id: 'seed-enquiry-01',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.seed-001',
      customerId: customerSarah.id,
      yardId: yardOakfield.id,
      sourceFrom: '+447700900001',
      subject: 'Routine dental check',
      rawText: 'Hi, I need to book routine dental checks for my 3 horses at Oakfield Stables. Mornings work best, any day Monday to Wednesday next month.',
      receivedAt: new Date('2026-04-01T09:15:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry1.id} (WhatsApp, TRIAGED)`);

  const enquiry2 = await prisma.enquiry.upsert({
    where: { id: 'seed-enquiry-02' },
    update: {},
    create: {
      id: 'seed-enquiry-02',
      channel: 'EMAIL',
      externalMessageId: '<seed-002@example.fr>',
      customerId: customerPierre.id,
      yardId: yardHaras.id,
      sourceFrom: 'pierre.dupont@example.fr',
      subject: 'Urgence — Éclat ne mange plus',
      rawText: 'Bonjour, mon cheval Éclat ne mange plus depuis 2 jours. Il semble avoir mal à la bouche et bave beaucoup. C\'est urgent, pouvez-vous venir rapidement au Haras de la Baie?',
      receivedAt: new Date('2026-04-02T14:30:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry2.id} (Email, TRIAGED)`);

  const enquiry3 = await prisma.enquiry.upsert({
    where: { id: 'seed-enquiry-03' },
    update: {},
    create: {
      id: 'seed-enquiry-03',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.seed-003',
      customerId: customerEmma.id,
      yardId: yardKingsway.id,
      sourceFrom: '+447700900003',
      subject: 'Riding school dental checks',
      rawText: 'Hello, I need to arrange dental checks for 2 horses at Kingsway Riding School. Tempest and Blaze are both due. We are flexible on timing but weekdays are easier.',
      receivedAt: new Date('2026-04-03T10:00:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry3.id} (WhatsApp, TRIAGED)`);

  const enquiry4 = await prisma.enquiry.upsert({
    where: { id: 'seed-enquiry-04' },
    update: {},
    create: {
      id: 'seed-enquiry-04',
      channel: 'EMAIL',
      externalMessageId: '<seed-004@example.co.uk>',
      customerId: customerEmma.id,
      yardId: yardExning.id,
      sourceFrom: 'emma.thompson@example.co.uk',
      subject: 'Two horses at Exning need dental work',
      rawText: 'Can you fit in Mist and Thunder at Exning Paddocks? Both are overdue for their dental checks. Any time in May or June.',
      receivedAt: new Date('2026-04-04T08:45:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry4.id} (Email, TRIAGED)`);

  const enquiry5 = await prisma.enquiry.upsert({
    where: { id: 'seed-enquiry-05' },
    update: {},
    create: {
      id: 'seed-enquiry-05',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.seed-005',
      customerId: customerJames.id,
      yardId: yardWillow.id,
      sourceFrom: '+447700900005',
      subject: 'Annual check for two old horses',
      rawText: 'This is James Wilson. Need the annual dental check for Biscuit and Pepper at Willow End Farm. Biscuit is getting on a bit so be gentle. Mornings only please.',
      receivedAt: new Date('2026-04-05T11:20:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry5.id} (WhatsApp, TRIAGED)`);

  const enquiry6 = await prisma.enquiry.upsert({
    where: { id: 'seed-enquiry-06' },
    update: {},
    create: {
      id: 'seed-enquiry-06',
      channel: 'EMAIL',
      externalMessageId: '<seed-006@example.fr>',
      customerId: customerMarie.id,
      yardId: yardBoulogne.id,
      sourceFrom: 'marie.lefevre@example.fr',
      subject: 'Contrôle dentaire pour 2 chevaux',
      rawText: 'Bonjour, je souhaite un contrôle dentaire de routine pour Orage et Cerise à l\'Écurie Côte d\'Opale. N\'importe quel jour en juin convient.',
      receivedAt: new Date('2026-04-06T16:00:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry6.id} (Email, TRIAGED)`);

  const enquiry7 = await prisma.enquiry.upsert({
    where: { id: 'seed-enquiry-07' },
    update: {},
    create: {
      id: 'seed-enquiry-07',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.seed-007',
      customerId: customerMarie.id,
      yardId: yardMarquise.id,
      sourceFrom: '+33698765432',
      subject: 'Mistral — problème dentaire',
      rawText: 'Mistral a du mal à mâcher et perd du poids. Il est à la Ferme Équestre de Marquise. Ce n\'est pas urgent mais il faudrait le voir assez vite.',
      receivedAt: new Date('2026-04-07T07:30:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry7.id} (WhatsApp, TRIAGED)`);

  const enquiry8 = await prisma.enquiry.upsert({
    where: { id: 'seed-enquiry-08' },
    update: {},
    create: {
      id: 'seed-enquiry-08',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.seed-008',
      customerId: customerEmma.id,
      yardId: yardMeadow.id,
      sourceFrom: '+447700900003',
      subject: 'First dental for young horse',
      rawText: 'Luna is 4 and has never had a dental check. Can you see her at Meadow Farm Livery? Also Apollo is due his annual check. Any time in July please.',
      receivedAt: new Date('2026-04-08T13:15:00Z'),
      triageStatus: 'PARSED',
    },
  });
  console.log(`  Enquiry: ${enquiry8.id} (WhatsApp, PARSED)`);

  const enquiry9 = await prisma.enquiry.upsert({
    where: { id: 'seed-enquiry-09' },
    update: {},
    create: {
      id: 'seed-enquiry-09',
      channel: 'EMAIL',
      externalMessageId: '<seed-009@example.com>',
      sourceFrom: 'unknown@example.com',
      subject: 'Horse dentist needed',
      rawText: 'Hi, I need a horse dentist for my horse. Can someone come?',
      receivedAt: new Date('2026-04-09T09:00:00Z'),
      triageStatus: 'NEEDS_INFO',
    },
  });
  console.log(`  Enquiry: ${enquiry9.id} (Email, NEEDS_INFO — unknown customer)`);

  const enquiry10 = await prisma.enquiry.upsert({
    where: { id: 'seed-enquiry-10' },
    update: {},
    create: {
      id: 'seed-enquiry-10',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.seed-010',
      sourceFrom: '+447700900099',
      subject: 'New enquiry',
      rawText: 'Hello, I just moved to the area and have 2 horses that need dental work. My name is Helen Baker.',
      receivedAt: new Date('2026-04-10T15:45:00Z'),
      triageStatus: 'NEW',
    },
  });
  console.log(`  Enquiry: ${enquiry10.id} (WhatsApp, NEW — new customer)`);

  // ─── Visit Requests (5: different planning statuses) ──────────────────────

  const visitRoutine = await prisma.visitRequest.upsert({
    where: { id: 'seed-visit-routine' },
    update: {},
    create: {
      id: 'seed-visit-routine',
      enquiryId: enquiry1.id,
      customerId: customerSarah.id,
      yardId: yardOakfield.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
      clinicalFlags: [],
      horseCount: 3,
      specificHorses: ['Bramble', 'Shadow', 'Fern'],
      preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
      preferredTimeBand: 'AM',
      earliestBookDate: new Date('2026-05-01'),
      latestBookDate: new Date('2026-06-30'),
      planningStatus: 'BOOKED',
      estimatedDurationMinutes: 120,
      autoTriageConfidence: 0.92,
    },
  });
  console.log(`  Visit request: ${visitRoutine.id} (BOOKED)`);

  const visitUrgent = await prisma.visitRequest.upsert({
    where: { id: 'seed-visit-urgent' },
    update: {},
    create: {
      id: 'seed-visit-urgent',
      enquiryId: enquiry2.id,
      customerId: customerPierre.id,
      yardId: yardHaras.id,
      requestType: 'URGENT_ISSUE',
      urgencyLevel: 'URGENT',
      clinicalFlags: ['not eating', 'drooling', 'oral pain'],
      horseCount: 1,
      specificHorses: ['Éclat'],
      preferredDays: [],
      preferredTimeBand: 'ANY',
      needsMoreInfo: false,
      planningStatus: 'BOOKED',
      estimatedDurationMinutes: 60,
      autoTriageConfidence: 0.97,
    },
  });
  console.log(`  Visit request: ${visitUrgent.id} (BOOKED)`);

  const visitPool = await prisma.visitRequest.upsert({
    where: { id: 'seed-visit-pool' },
    update: {},
    create: {
      id: 'seed-visit-pool',
      enquiryId: enquiry3.id,
      customerId: customerEmma.id,
      yardId: yardKingsway.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
      clinicalFlags: [],
      horseCount: 2,
      specificHorses: ['Tempest', 'Blaze'],
      preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      preferredTimeBand: 'ANY',
      planningStatus: 'PLANNING_POOL',
      estimatedDurationMinutes: 90,
      autoTriageConfidence: 0.89,
    },
  });
  console.log(`  Visit request: ${visitPool.id} (PLANNING_POOL)`);

  const visitSoon = await prisma.visitRequest.upsert({
    where: { id: 'seed-visit-soon' },
    update: {},
    create: {
      id: 'seed-visit-soon',
      enquiryId: enquiry7.id,
      customerId: customerMarie.id,
      yardId: yardMarquise.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'SOON',
      clinicalFlags: ['difficulty chewing', 'weight loss'],
      horseCount: 1,
      specificHorses: ['Mistral'],
      preferredDays: [],
      preferredTimeBand: 'ANY',
      planningStatus: 'PLANNING_POOL',
      estimatedDurationMinutes: 60,
      autoTriageConfidence: 0.85,
    },
  });
  console.log(`  Visit request: ${visitSoon.id} (PLANNING_POOL)`);

  const visitUntriaged = await prisma.visitRequest.upsert({
    where: { id: 'seed-visit-untriaged' },
    update: {},
    create: {
      id: 'seed-visit-untriaged',
      enquiryId: enquiry5.id,
      customerId: customerJames.id,
      yardId: yardWillow.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
      clinicalFlags: [],
      horseCount: 2,
      specificHorses: ['Biscuit', 'Pepper'],
      preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
      preferredTimeBand: 'AM',
      earliestBookDate: new Date('2026-05-01'),
      latestBookDate: new Date('2026-06-30'),
      planningStatus: 'READY_FOR_REVIEW',
      estimatedDurationMinutes: 90,
      autoTriageConfidence: 0.91,
    },
  });
  console.log(`  Visit request: ${visitUntriaged.id} (READY_FOR_REVIEW)`);

  // ─── Route Run (1 with stops) ────────────────────────────────────────────

  const routeRun = await prisma.routeRun.upsert({
    where: { id: 'seed-route-run-01' },
    update: {},
    create: {
      id: 'seed-route-run-01',
      runDate: new Date('2026-05-06'),
      homeBaseAddress: '10 High Street, Newmarket, CB8 8LB',
      startTime: new Date('2026-05-06T08:00:00Z'),
      endTime: new Date('2026-05-06T14:30:00Z'),
      status: 'BOOKED',
      totalDistanceMeters: 42000,
      totalTravelMinutes: 55,
      totalVisitMinutes: 180,
      totalJobs: 2,
      totalHorses: 4,
      optimizationScore: 0.87,
      notes: 'Morning route — Newmarket area. Sarah Jones (3 horses) then Pierre Dupont (1 horse, urgent).',
    },
  });
  console.log(`  Route run: ${routeRun.id} (${routeRun.runDate.toISOString().split('T')[0]}, BOOKED)`);

  await prisma.routeRunStop.upsert({
    where: { id: 'seed-stop-01' },
    update: {},
    create: {
      id: 'seed-stop-01',
      routeRunId: routeRun.id,
      sequenceNo: 1,
      visitRequestId: visitRoutine.id,
      yardId: yardOakfield.id,
      plannedArrival: new Date('2026-05-06T08:30:00Z'),
      plannedDeparture: new Date('2026-05-06T10:30:00Z'),
      serviceMinutes: 120,
      travelFromPrevMinutes: 15,
      travelFromPrevMeters: 8000,
      stopStatus: 'CONFIRMED',
    },
  });
  console.log('  Route stop 1: Oakfield Stables (CONFIRMED)');

  await prisma.routeRunStop.upsert({
    where: { id: 'seed-stop-02' },
    update: {},
    create: {
      id: 'seed-stop-02',
      routeRunId: routeRun.id,
      sequenceNo: 2,
      visitRequestId: visitUrgent.id,
      yardId: yardHaras.id,
      plannedArrival: new Date('2026-05-06T12:00:00Z'),
      plannedDeparture: new Date('2026-05-06T13:00:00Z'),
      serviceMinutes: 60,
      travelFromPrevMinutes: 90,
      travelFromPrevMeters: 120000,
      stopStatus: 'PLANNED',
    },
  });
  console.log('  Route stop 2: Haras de la Baie (PLANNED)');

  // ─── Appointments (2: 1 confirmed, 1 proposed) ───────────────────────────

  const apptConfirmed = await prisma.appointment.upsert({
    where: { id: 'seed-appt-confirmed' },
    update: {},
    create: {
      id: 'seed-appt-confirmed',
      visitRequestId: visitRoutine.id,
      routeRunId: routeRun.id,
      appointmentStart: new Date('2026-05-06T08:30:00Z'),
      appointmentEnd: new Date('2026-05-06T10:30:00Z'),
      status: 'CONFIRMED',
      confirmationChannel: 'WHATSAPP',
      confirmationSentAt: new Date('2026-04-14T10:00:00Z'),
    },
  });
  console.log(`  Appointment: ${apptConfirmed.id} (CONFIRMED — Sarah Jones, Oakfield Stables)`);

  const apptProposed = await prisma.appointment.upsert({
    where: { id: 'seed-appt-proposed' },
    update: {},
    create: {
      id: 'seed-appt-proposed',
      visitRequestId: visitUrgent.id,
      routeRunId: routeRun.id,
      appointmentStart: new Date('2026-05-06T12:00:00Z'),
      appointmentEnd: new Date('2026-05-06T13:00:00Z'),
      status: 'PROPOSED',
    },
  });
  console.log(`  Appointment: ${apptProposed.id} (PROPOSED — Pierre Dupont, Haras de la Baie)`);

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log('\n═══ Seed Summary ═══');
  console.log('  Customers: 5 (3 EN, 2 FR)');
  console.log('  Yards: 8 (3 Newmarket, 2 Cambridge, 3 Pas-de-Calais)');
  console.log('  Horses: 15');
  console.log('  Enquiries: 10 (5 WhatsApp, 5 Email; various statuses)');
  console.log('  Visit Requests: 5 (BOOKED, PLANNING_POOL, READY_FOR_REVIEW)');
  console.log('  Route Runs: 1 (BOOKED, 2 stops)');
  console.log('  Appointments: 2 (1 CONFIRMED, 1 PROPOSED)');
  console.log('\nSeeding complete.');
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
