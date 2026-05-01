import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo database (Swiss equine vet)...\n');

  // ─── Staff (2 vets + 1 nurse) ────────────────────────────────────────────

  await prisma.staff.upsert({
    where: { email: 'rachel@equismile.example' },
    update: {},
    create: {
      id: 'demo-staff-rachel',
      name: 'Dr. Rachel Kemp',
      email: 'rachel@equismile.example',
      phone: '+41799100001',
      role: 'VET',
      colour: '#9b214d',
      notes: 'Lead equine dental vet — founder.',
    },
  });
  console.log('  Staff: Dr. Rachel Kemp (lead vet)');

  await prisma.staff.upsert({
    where: { email: 'second.vet@equismile.example' },
    update: {},
    create: {
      id: 'demo-staff-second',
      name: 'Dr. Alex Moreau',
      email: 'second.vet@equismile.example',
      phone: '+41799100002',
      role: 'VET',
      colour: '#1e40af',
      notes: 'Visiting vet — alternates rounds with Rachel.',
    },
  });
  console.log('  Staff: Dr. Alex Moreau (visiting vet)');

  await prisma.staff.upsert({
    where: { email: 'nurse@equismile.example' },
    update: {},
    create: {
      id: 'demo-staff-nurse',
      name: 'Léa Bertrand',
      email: 'nurse@equismile.example',
      role: 'NURSE',
      colour: '#16a34a',
      notes: 'Veterinary nurse — joins joint rounds.',
    },
  });
  console.log('  Staff: Léa Bertrand (nurse)');

  // ─── Customers (8: 4 FR, 4 EN) ──────────────────────────────────────────

  const marieDupont = await prisma.customer.upsert({
    where: { email: 'marie.dupont@example.ch' },
    update: {},
    create: {
      id: 'demo-customer-marie',
      fullName: 'Marie Dupont',
      mobilePhone: '+41799001234',
      email: 'marie.dupont@example.ch',
      preferredChannel: 'WHATSAPP',
      preferredLanguage: 'fr',
      notes: 'Propriétaire de 3 chevaux à Villeneuve. Préfère le matin.',
    },
  });
  console.log(`  Customer (FR): ${marieDupont.fullName}`);

  const sarahMitchell = await prisma.customer.upsert({
    where: { email: 'sarah.mitchell@example.com' },
    update: {},
    create: {
      id: 'demo-customer-sarah',
      fullName: 'Sarah Mitchell',
      mobilePhone: '+41799002345',
      email: 'sarah.mitchell@example.com',
      preferredChannel: 'WHATSAPP',
      preferredLanguage: 'en',
      notes: 'Expat in Montreux, 2 horses. Prefers English communication.',
    },
  });
  console.log(`  Customer (EN): ${sarahMitchell.fullName}`);

  const pierreRochat = await prisma.customer.upsert({
    where: { email: 'pierre.rochat@example.ch' },
    update: {},
    create: {
      id: 'demo-customer-pierre',
      fullName: 'Pierre Rochat',
      mobilePhone: '+41799003456',
      email: 'pierre.rochat@example.ch',
      preferredChannel: 'EMAIL',
      preferredLanguage: 'fr',
      notes: 'Éleveur à Aigle. Gère un petit haras de 5 chevaux.',
    },
  });
  console.log(`  Customer (FR): ${pierreRochat.fullName}`);

  const emmaWilson = await prisma.customer.upsert({
    where: { email: 'emma.wilson@example.com' },
    update: {},
    create: {
      id: 'demo-customer-emma',
      fullName: 'Emma Wilson',
      mobilePhone: '+41799004567',
      email: 'emma.wilson@example.com',
      preferredChannel: 'WHATSAPP',
      preferredLanguage: 'en',
      notes: 'Runs a small riding school near Château-d\'Oex. Very organised.',
    },
  });
  console.log(`  Customer (EN): ${emmaWilson.fullName}`);

  const jeanLucFavre = await prisma.customer.upsert({
    where: { email: 'jeanluc.favre@example.ch' },
    update: {},
    create: {
      id: 'demo-customer-jeanluc',
      fullName: 'Jean-Luc Favre',
      mobilePhone: '+41799005678',
      email: 'jeanluc.favre@example.ch',
      preferredChannel: 'PHONE',
      preferredLanguage: 'fr',
      notes: 'Agriculteur à Bulle. Préfère les appels téléphoniques.',
    },
  });
  console.log(`  Customer (FR): ${jeanLucFavre.fullName}`);

  const rachelThompson = await prisma.customer.upsert({
    where: { email: 'rachel.thompson@example.com' },
    update: {},
    create: {
      id: 'demo-customer-rachel',
      fullName: 'Rachel Thompson',
      mobilePhone: '+41799006789',
      email: 'rachel.thompson@example.com',
      preferredChannel: 'EMAIL',
      preferredLanguage: 'en',
      notes: 'British equestrian coach based in Avenches. Very detail-oriented.',
    },
  });
  console.log(`  Customer (EN): ${rachelThompson.fullName}`);

  const isabelleMoret = await prisma.customer.upsert({
    where: { email: 'isabelle.moret@example.ch' },
    update: {},
    create: {
      id: 'demo-customer-isabelle',
      fullName: 'Isabelle Moret',
      mobilePhone: '+41799007890',
      email: 'isabelle.moret@example.ch',
      preferredChannel: 'WHATSAPP',
      preferredLanguage: 'fr',
      notes: 'Cavalière de compétition à Lausanne. 2 chevaux de dressage.',
    },
  });
  console.log(`  Customer (FR): ${isabelleMoret.fullName}`);

  const davidBrown = await prisma.customer.upsert({
    where: { email: 'david.brown@example.com' },
    update: {},
    create: {
      id: 'demo-customer-david',
      fullName: 'David Brown',
      mobilePhone: '+41799008901',
      email: 'david.brown@example.com',
      preferredChannel: 'WHATSAPP',
      preferredLanguage: 'en',
      notes: 'Retired farmer near Nyon. 2 elderly horses, gentle handling needed.',
    },
  });
  console.log(`  Customer (EN): ${davidBrown.fullName}`);

  // ─── Yards (8 with real Swiss addresses) ─────────────────────────────────

  const yardVilleneuve = await prisma.yard.upsert({
    where: { id: 'demo-yard-villeneuve' },
    update: {},
    create: {
      id: 'demo-yard-villeneuve',
      customerId: marieDupont.id,
      yardName: 'Écurie du Lac',
      addressLine1: '12 Route du Lac',
      town: 'Villeneuve',
      county: 'Vaud',
      postcode: '1844',
      latitude: 46.3970,
      longitude: 6.9277,
      geocodedAt: new Date(),
      accessNotes: 'Entrée par le chemin de terre après le camping. Chien amical.',
      areaLabel: 'Villeneuve VD',
    },
  });
  console.log(`  Yard: ${yardVilleneuve.yardName} (${yardVilleneuve.postcode})`);

  const yardMontreux = await prisma.yard.upsert({
    where: { id: 'demo-yard-montreux' },
    update: {},
    create: {
      id: 'demo-yard-montreux',
      customerId: sarahMitchell.id,
      yardName: 'Montreux Equestrian Centre',
      addressLine1: '45 Avenue des Alpes',
      town: 'Montreux',
      county: 'Vaud',
      postcode: '1820',
      latitude: 46.4312,
      longitude: 6.9107,
      geocodedAt: new Date(),
      accessNotes: 'Main gate with keypad — code 7890. Park by the arena.',
      areaLabel: 'Montreux',
    },
  });
  console.log(`  Yard: ${yardMontreux.yardName} (${yardMontreux.postcode})`);

  const yardAigle = await prisma.yard.upsert({
    where: { id: 'demo-yard-aigle' },
    update: {},
    create: {
      id: 'demo-yard-aigle',
      customerId: pierreRochat.id,
      yardName: 'Haras de l\'Aigle',
      addressLine1: '8 Chemin des Vignes',
      town: 'Aigle',
      county: 'Vaud',
      postcode: '1860',
      latitude: 46.3180,
      longitude: 6.9706,
      geocodedAt: new Date(),
      accessNotes: 'Portail électrique — sonner à l\'interphone. Accès camion possible.',
      areaLabel: 'Aigle',
    },
  });
  console.log(`  Yard: ${yardAigle.yardName} (${yardAigle.postcode})`);

  const yardChateauDoex = await prisma.yard.upsert({
    where: { id: 'demo-yard-chateau-doex' },
    update: {},
    create: {
      id: 'demo-yard-chateau-doex',
      customerId: emmaWilson.id,
      yardName: 'Alpine Riding School',
      addressLine1: '3 Route de la Gare',
      town: 'Château-d\'Oex',
      county: 'Vaud',
      postcode: '1660',
      latitude: 46.4747,
      longitude: 7.1366,
      geocodedAt: new Date(),
      accessNotes: 'Narrow mountain road — no large trailers. Ring bell at barn.',
      areaLabel: 'Château-d\'Oex',
    },
  });
  console.log(`  Yard: ${yardChateauDoex.yardName} (${yardChateauDoex.postcode})`);

  const yardBulle = await prisma.yard.upsert({
    where: { id: 'demo-yard-bulle' },
    update: {},
    create: {
      id: 'demo-yard-bulle',
      customerId: jeanLucFavre.id,
      yardName: 'Ferme Favre',
      addressLine1: '22 Route de Gruyères',
      town: 'Bulle',
      county: 'Fribourg',
      postcode: '1630',
      latitude: 46.6193,
      longitude: 7.0570,
      geocodedAt: new Date(),
      accessNotes: 'Ferme traditionnelle, chevaux au pré. Se garer devant la grange.',
      areaLabel: 'Bulle',
    },
  });
  console.log(`  Yard: ${yardBulle.yardName} (${yardBulle.postcode})`);

  const yardAvenches = await prisma.yard.upsert({
    where: { id: 'demo-yard-avenches' },
    update: {},
    create: {
      id: 'demo-yard-avenches',
      customerId: rachelThompson.id,
      yardName: 'IENA Avenches Stables',
      addressLine1: '15 Rue du Château',
      town: 'Avenches',
      county: 'Vaud',
      postcode: '1580',
      latitude: 46.8820,
      longitude: 7.0422,
      geocodedAt: new Date(),
      accessNotes: 'Near the national equestrian centre. Large parking area.',
      areaLabel: 'Avenches',
    },
  });
  console.log(`  Yard: ${yardAvenches.yardName} (${yardAvenches.postcode})`);

  const yardLausanne = await prisma.yard.upsert({
    where: { id: 'demo-yard-lausanne' },
    update: {},
    create: {
      id: 'demo-yard-lausanne',
      customerId: isabelleMoret.id,
      yardName: 'Centre Équestre de Sauvabelin',
      addressLine1: '5 Chemin de Sauvabelin',
      town: 'Lausanne',
      county: 'Vaud',
      postcode: '1018',
      latitude: 46.5197,
      longitude: 6.6323,
      geocodedAt: new Date(),
      accessNotes: 'Dans la forêt de Sauvabelin. Suivre les panneaux depuis la gare.',
      areaLabel: 'Lausanne',
    },
  });
  console.log(`  Yard: ${yardLausanne.yardName} (${yardLausanne.postcode})`);

  const yardNyon = await prisma.yard.upsert({
    where: { id: 'demo-yard-nyon' },
    update: {},
    create: {
      id: 'demo-yard-nyon',
      customerId: davidBrown.id,
      yardName: 'Paddock du Léman',
      addressLine1: '9 Chemin des Pâquis',
      town: 'Nyon',
      county: 'Vaud',
      postcode: '1260',
      latitude: 46.3833,
      longitude: 6.2398,
      geocodedAt: new Date(),
      accessNotes: 'Small paddock behind the house. Park on grass verge.',
      areaLabel: 'Nyon',
    },
  });
  console.log(`  Yard: ${yardNyon.yardName} (${yardNyon.postcode})`);

  // ─── Horses (20) ─────────────────────────────────────────────────────────

  const horsesData = [
    // Marie Dupont — Villeneuve (3 horses)
    { id: 'demo-horse-eclat', name: 'Éclat', age: 7, customer: marieDupont, yard: yardVilleneuve, notes: 'Cheval de sport, sensible à la bouche. Sédation légère recommandée.', due: '2026-06-01' },
    { id: 'demo-horse-bijou', name: 'Bijou', age: 12, customer: marieDupont, yard: yardVilleneuve, notes: 'Jument calme, contrôle de routine annuel.', due: '2026-06-01' },
    { id: 'demo-horse-tonnerre', name: 'Tonnerre', age: 5, customer: marieDupont, yard: yardVilleneuve, notes: 'Jeune hongre, premier examen dentaire complet.', due: '2026-06-15' },
    // Sarah Mitchell — Montreux (2 horses)
    { id: 'demo-horse-bramble', name: 'Bramble', age: 14, customer: sarahMitchell, yard: yardMontreux, notes: 'History of wolf tooth issues. Needs gentle handling.', due: '2026-05-20' },
    { id: 'demo-horse-shadow', name: 'Shadow', age: 9, customer: sarahMitchell, yard: yardMontreux, notes: 'Calm temperament, straightforward dental work.', due: '2026-05-20' },
    // Pierre Rochat — Aigle (3 horses)
    { id: 'demo-horse-mistral', name: 'Mistral', age: 8, customer: pierreRochat, yard: yardAigle, notes: 'Hongre nerveux, nécessite un manipulateur expérimenté.', due: '2026-07-01' },
    { id: 'demo-horse-alpine', name: 'Alpine', age: 6, customer: pierreRochat, yard: yardAigle, notes: 'Jument de dressage, bouche en bon état.', due: '2026-07-01' },
    { id: 'demo-horse-zenith', name: 'Zénith', age: 4, customer: pierreRochat, yard: yardAigle, notes: 'Premier examen. Poulain un peu craintif.', due: '2026-07-15' },
    // Emma Wilson — Château-d'Oex (3 horses)
    { id: 'demo-horse-blaze', name: 'Blaze', age: 10, customer: emmaWilson, yard: yardChateauDoex, notes: 'Riding school horse, regular check. Sharp enamel points previously.', due: '2026-06-10' },
    { id: 'demo-horse-fern', name: 'Fern', age: 15, customer: emmaWilson, yard: yardChateauDoex, notes: 'Older mare, check for periodontal disease.', due: '2026-06-10' },
    { id: 'demo-horse-comet', name: 'Comet', age: 6, customer: emmaWilson, yard: yardChateauDoex, notes: 'Competition pony, mouth guard check needed.', due: '2026-06-10' },
    // Jean-Luc Favre — Bulle (2 horses)
    { id: 'demo-horse-orage', name: 'Orage', age: 18, customer: jeanLucFavre, yard: yardBulle, notes: 'Vieux cheval de ferme. Contrôle annuel. Doux et patient.', due: '2026-05-15' },
    { id: 'demo-horse-cerise', name: 'Cerise', age: 11, customer: jeanLucFavre, yard: yardBulle, notes: 'Jument de trait. Solide, facile à manipuler.', due: '2026-05-15' },
    // Rachel Thompson — Avenches (3 horses)
    { id: 'demo-horse-tempest', name: 'Tempest', age: 8, customer: rachelThompson, yard: yardAvenches, notes: 'Event horse, needs annual dental before competition season.', due: '2026-05-01' },
    { id: 'demo-horse-luna', name: 'Luna', age: 5, customer: rachelThompson, yard: yardAvenches, notes: 'Young mare, second dental exam.', due: '2026-05-01' },
    { id: 'demo-horse-apollo', name: 'Apollo', age: 12, customer: rachelThompson, yard: yardAvenches, notes: 'Dressage horse. History of hooks on upper molars.', due: '2026-05-01' },
    // Isabelle Moret — Lausanne (2 horses)
    { id: 'demo-horse-duchesse', name: 'Duchesse', age: 9, customer: isabelleMoret, yard: yardLausanne, notes: 'Jument de dressage Grand Prix. Bouche sensible.', due: '2026-06-20' },
    { id: 'demo-horse-prince', name: 'Prince', age: 7, customer: isabelleMoret, yard: yardLausanne, notes: 'Hongre KWPN, contrôle de routine.', due: '2026-06-20' },
    // David Brown — Nyon (2 horses)
    { id: 'demo-horse-biscuit', name: 'Biscuit', age: 24, customer: davidBrown, yard: yardNyon, notes: 'Very old gelding, limited dental work. Cushings disease.', due: '2026-05-10' },
    { id: 'demo-horse-pepper', name: 'Pepper', age: 20, customer: davidBrown, yard: yardNyon, notes: 'Retired mare, yearly check only. Gentle handling essential.', due: '2026-05-10' },
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

  // ─── Enquiries (12: various stages) ──────────────────────────────────────

  const enquiry1 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-01' },
    update: {},
    create: {
      id: 'demo-enquiry-01',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.demo-001',
      customerId: marieDupont.id,
      yardId: yardVilleneuve.id,
      sourceFrom: '+41799001234',
      subject: 'Contrôle dentaire de routine',
      rawText: 'Bonjour, je souhaite prendre rendez-vous pour un contrôle dentaire de routine pour mes 3 chevaux à Villeneuve. Le matin de préférence, n\'importe quel jour en mai.',
      receivedAt: new Date('2026-04-01T09:15:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry1.id} (TRIAGED)`);

  const enquiry2 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-02' },
    update: {},
    create: {
      id: 'demo-enquiry-02',
      channel: 'EMAIL',
      externalMessageId: '<demo-002@example.com>',
      customerId: sarahMitchell.id,
      yardId: yardMontreux.id,
      sourceFrom: 'sarah.mitchell@example.com',
      subject: 'Dental check for 2 horses at Montreux',
      rawText: 'Hi, I need to book dental checks for Bramble and Shadow at Montreux Equestrian Centre. Any morning in May works for us.',
      receivedAt: new Date('2026-04-02T10:30:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry2.id} (TRIAGED)`);

  const enquiry3 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-03' },
    update: {},
    create: {
      id: 'demo-enquiry-03',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.demo-003',
      customerId: pierreRochat.id,
      yardId: yardAigle.id,
      sourceFrom: '+41799003456',
      subject: 'Urgence — Mistral ne mange plus',
      rawText: 'Bonjour, mon cheval Mistral ne mange plus depuis 2 jours. Il bave et semble avoir mal. Pouvez-vous venir rapidement au Haras de l\'Aigle?',
      receivedAt: new Date('2026-04-03T14:00:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry3.id} (TRIAGED — urgent)`);

  const enquiry4 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-04' },
    update: {},
    create: {
      id: 'demo-enquiry-04',
      channel: 'EMAIL',
      externalMessageId: '<demo-004@example.com>',
      customerId: emmaWilson.id,
      yardId: yardChateauDoex.id,
      sourceFrom: 'emma.wilson@example.com',
      subject: 'Riding school dental checks — 3 horses',
      rawText: 'Hello, I need to arrange dental checks for Blaze, Fern, and Comet at Alpine Riding School. Weekdays work best, flexible on dates in June.',
      receivedAt: new Date('2026-04-04T08:45:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry4.id} (TRIAGED)`);

  const enquiry5 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-05' },
    update: {},
    create: {
      id: 'demo-enquiry-05',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.demo-005',
      customerId: jeanLucFavre.id,
      yardId: yardBulle.id,
      sourceFrom: '+41799005678',
      subject: 'Contrôle annuel — 2 chevaux',
      rawText: 'C\'est Jean-Luc Favre de Bulle. Orage et Cerise ont besoin de leur contrôle annuel. Le matin uniquement svp.',
      receivedAt: new Date('2026-04-05T11:20:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry5.id} (TRIAGED)`);

  const enquiry6 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-06' },
    update: {},
    create: {
      id: 'demo-enquiry-06',
      channel: 'EMAIL',
      externalMessageId: '<demo-006@example.com>',
      customerId: rachelThompson.id,
      yardId: yardAvenches.id,
      sourceFrom: 'rachel.thompson@example.com',
      subject: 'Annual dental for competition horses',
      rawText: 'Dear EquiSmile, I need annual dental checks for Tempest, Luna, and Apollo at IENA Avenches Stables before the competition season starts in May.',
      receivedAt: new Date('2026-04-06T16:00:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry6.id} (TRIAGED)`);

  const enquiry7 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-07' },
    update: {},
    create: {
      id: 'demo-enquiry-07',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.demo-007',
      customerId: isabelleMoret.id,
      yardId: yardLausanne.id,
      sourceFrom: '+41799007890',
      subject: 'Contrôle dentaire — chevaux de dressage',
      rawText: 'Bonjour, je souhaite un contrôle dentaire pour Duchesse et Prince au Centre Équestre de Sauvabelin. En juin si possible.',
      receivedAt: new Date('2026-04-07T07:30:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry7.id} (TRIAGED)`);

  const enquiry8 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-08' },
    update: {},
    create: {
      id: 'demo-enquiry-08',
      channel: 'EMAIL',
      externalMessageId: '<demo-008@example.com>',
      customerId: davidBrown.id,
      yardId: yardNyon.id,
      sourceFrom: 'david.brown@example.com',
      subject: 'Elderly horses — annual dental',
      rawText: 'Hello, my two elderly horses Biscuit (24) and Pepper (20) need their annual dental check at Paddock du Léman, Nyon. Please be gentle — they\'re both quite old. Mornings only.',
      receivedAt: new Date('2026-04-08T13:15:00Z'),
      triageStatus: 'TRIAGED',
    },
  });
  console.log(`  Enquiry: ${enquiry8.id} (TRIAGED)`);

  // Enquiries at earlier stages
  const enquiry9 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-09' },
    update: {},
    create: {
      id: 'demo-enquiry-09',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.demo-009',
      sourceFrom: '+41799099999',
      subject: 'New enquiry',
      rawText: 'Bonjour, j\'ai un cheval qui a besoin d\'un dentiste. Pouvez-vous m\'aider?',
      receivedAt: new Date('2026-04-09T09:00:00Z'),
      triageStatus: 'NEEDS_INFO',
    },
  });
  console.log(`  Enquiry: ${enquiry9.id} (NEEDS_INFO — unknown customer)`);

  const enquiry10 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-10' },
    update: {},
    create: {
      id: 'demo-enquiry-10',
      channel: 'EMAIL',
      externalMessageId: '<demo-010@example.com>',
      sourceFrom: 'new.customer@example.com',
      subject: 'Horse dentist needed',
      rawText: 'Hi, I just moved to Vevey with my horse and need a dental check. My name is Clara Meier.',
      receivedAt: new Date('2026-04-10T15:45:00Z'),
      triageStatus: 'NEW',
    },
  });
  console.log(`  Enquiry: ${enquiry10.id} (NEW)`);

  const enquiry11 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-11' },
    update: {},
    create: {
      id: 'demo-enquiry-11',
      channel: 'WHATSAPP',
      externalMessageId: 'wamid.demo-011',
      sourceFrom: '+41799088888',
      subject: 'Parsed enquiry',
      rawText: 'Hello, my horse needs dental work. I have 2 horses at my farm in Gruyères. Available any weekday.',
      receivedAt: new Date('2026-04-11T10:00:00Z'),
      triageStatus: 'PARSED',
    },
  });
  console.log(`  Enquiry: ${enquiry11.id} (PARSED)`);

  const enquiry12 = await prisma.enquiry.upsert({
    where: { id: 'demo-enquiry-12' },
    update: {},
    create: {
      id: 'demo-enquiry-12',
      channel: 'EMAIL',
      externalMessageId: '<demo-012@example.com>',
      sourceFrom: 'another.new@example.com',
      subject: 'Urgent — horse in pain',
      rawText: 'My horse is in severe pain and can\'t eat. We\'re near Vevey. Please help urgently!',
      receivedAt: new Date('2026-04-12T08:30:00Z'),
      triageStatus: 'NEW',
    },
  });
  console.log(`  Enquiry: ${enquiry12.id} (NEW — urgent)`);

  // ─── Visit Requests (8) ──────────────────────────────────────────────────

  const visitBooked1 = await prisma.visitRequest.upsert({
    where: { id: 'demo-visit-booked-1' },
    update: { planningStatus: 'BOOKED' },
    create: {
      id: 'demo-visit-booked-1',
      enquiryId: enquiry1.id,
      customerId: marieDupont.id,
      yardId: yardVilleneuve.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
      clinicalFlags: [],
      horseCount: 3,
      specificHorses: ['Éclat', 'Bijou', 'Tonnerre'],
      preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
      preferredTimeBand: 'AM',
      earliestBookDate: new Date('2026-05-01'),
      latestBookDate: new Date('2026-06-30'),
      planningStatus: 'BOOKED',
      estimatedDurationMinutes: 120,
      autoTriageConfidence: 0.92,
    },
  });
  console.log(`  Visit: ${visitBooked1.id} (BOOKED)`);

  const visitBooked2 = await prisma.visitRequest.upsert({
    where: { id: 'demo-visit-booked-2' },
    update: { planningStatus: 'BOOKED' },
    create: {
      id: 'demo-visit-booked-2',
      enquiryId: enquiry3.id,
      customerId: pierreRochat.id,
      yardId: yardAigle.id,
      requestType: 'URGENT_ISSUE',
      urgencyLevel: 'URGENT',
      clinicalFlags: ['not eating', 'drooling', 'oral pain'],
      horseCount: 1,
      specificHorses: ['Mistral'],
      preferredDays: [],
      preferredTimeBand: 'ANY',
      planningStatus: 'BOOKED',
      estimatedDurationMinutes: 60,
      autoTriageConfidence: 0.97,
    },
  });
  console.log(`  Visit: ${visitBooked2.id} (BOOKED — urgent)`);

  const visitPool1 = await prisma.visitRequest.upsert({
    where: { id: 'demo-visit-pool-1' },
    update: { planningStatus: 'PLANNING_POOL' },
    create: {
      id: 'demo-visit-pool-1',
      enquiryId: enquiry2.id,
      customerId: sarahMitchell.id,
      yardId: yardMontreux.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
      clinicalFlags: [],
      horseCount: 2,
      specificHorses: ['Bramble', 'Shadow'],
      preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      preferredTimeBand: 'AM',
      planningStatus: 'PLANNING_POOL',
      estimatedDurationMinutes: 90,
      autoTriageConfidence: 0.89,
    },
  });
  console.log(`  Visit: ${visitPool1.id} (PLANNING_POOL)`);

  const visitPool2 = await prisma.visitRequest.upsert({
    where: { id: 'demo-visit-pool-2' },
    update: { planningStatus: 'PLANNING_POOL' },
    create: {
      id: 'demo-visit-pool-2',
      enquiryId: enquiry4.id,
      customerId: emmaWilson.id,
      yardId: yardChateauDoex.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
      clinicalFlags: [],
      horseCount: 3,
      specificHorses: ['Blaze', 'Fern', 'Comet'],
      preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      preferredTimeBand: 'ANY',
      planningStatus: 'PLANNING_POOL',
      estimatedDurationMinutes: 120,
      autoTriageConfidence: 0.90,
    },
  });
  console.log(`  Visit: ${visitPool2.id} (PLANNING_POOL)`);

  const visitPool3 = await prisma.visitRequest.upsert({
    where: { id: 'demo-visit-pool-3' },
    update: { planningStatus: 'PLANNING_POOL' },
    create: {
      id: 'demo-visit-pool-3',
      enquiryId: enquiry7.id,
      customerId: isabelleMoret.id,
      yardId: yardLausanne.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
      clinicalFlags: [],
      horseCount: 2,
      specificHorses: ['Duchesse', 'Prince'],
      preferredDays: [],
      preferredTimeBand: 'ANY',
      planningStatus: 'PLANNING_POOL',
      estimatedDurationMinutes: 90,
      autoTriageConfidence: 0.88,
    },
  });
  console.log(`  Visit: ${visitPool3.id} (PLANNING_POOL)`);

  const visitReview = await prisma.visitRequest.upsert({
    where: { id: 'demo-visit-review' },
    update: { planningStatus: 'READY_FOR_REVIEW' },
    create: {
      id: 'demo-visit-review',
      enquiryId: enquiry5.id,
      customerId: jeanLucFavre.id,
      yardId: yardBulle.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
      clinicalFlags: [],
      horseCount: 2,
      specificHorses: ['Orage', 'Cerise'],
      preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
      preferredTimeBand: 'AM',
      earliestBookDate: new Date('2026-05-01'),
      latestBookDate: new Date('2026-06-30'),
      planningStatus: 'READY_FOR_REVIEW',
      estimatedDurationMinutes: 90,
      autoTriageConfidence: 0.91,
    },
  });
  console.log(`  Visit: ${visitReview.id} (READY_FOR_REVIEW)`);

  await prisma.visitRequest.upsert({
    where: { id: 'demo-visit-pool-4' },
    update: { planningStatus: 'PLANNING_POOL' },
    create: {
      id: 'demo-visit-pool-4',
      enquiryId: enquiry6.id,
      customerId: rachelThompson.id,
      yardId: yardAvenches.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'SOON',
      clinicalFlags: [],
      horseCount: 3,
      specificHorses: ['Tempest', 'Luna', 'Apollo'],
      preferredDays: [],
      preferredTimeBand: 'ANY',
      planningStatus: 'PLANNING_POOL',
      estimatedDurationMinutes: 120,
      autoTriageConfidence: 0.86,
    },
  });
  console.log('  Visit: demo-visit-pool-4 (PLANNING_POOL)');

  await prisma.visitRequest.upsert({
    where: { id: 'demo-visit-pool-5' },
    update: { planningStatus: 'PLANNING_POOL' },
    create: {
      id: 'demo-visit-pool-5',
      enquiryId: enquiry8.id,
      customerId: davidBrown.id,
      yardId: yardNyon.id,
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
      clinicalFlags: [],
      horseCount: 2,
      specificHorses: ['Biscuit', 'Pepper'],
      preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
      preferredTimeBand: 'AM',
      earliestBookDate: new Date('2026-05-01'),
      latestBookDate: new Date('2026-06-30'),
      planningStatus: 'PLANNING_POOL',
      estimatedDurationMinutes: 90,
      autoTriageConfidence: 0.90,
    },
  });
  console.log('  Visit: demo-visit-pool-5 (PLANNING_POOL)');

  // ─── Route Runs (3: 1 draft, 1 approved, 1 completed) ───────────────────

  const routeDraft = await prisma.routeRun.upsert({
    where: { id: 'demo-route-draft' },
    update: {},
    create: {
      id: 'demo-route-draft',
      runDate: new Date('2026-05-12'),
      homeBaseAddress: 'Blonay, 1807, Switzerland',
      startTime: new Date('2026-05-12T08:00:00Z'),
      endTime: new Date('2026-05-12T15:00:00Z'),
      status: 'DRAFT',
      totalDistanceMeters: 85000,
      totalTravelMinutes: 120,
      totalVisitMinutes: 300,
      totalJobs: 3,
      totalHorses: 7,
      optimizationScore: 0.82,
      notes: 'Draft route — Villeneuve, Montreux, Aigle area.',
    },
  });
  console.log(`  Route: ${routeDraft.id} (DRAFT)`);

  const routeApproved = await prisma.routeRun.upsert({
    where: { id: 'demo-route-approved' },
    update: {},
    create: {
      id: 'demo-route-approved',
      runDate: new Date('2026-05-06'),
      homeBaseAddress: 'Blonay, 1807, Switzerland',
      startTime: new Date('2026-05-06T08:00:00Z'),
      endTime: new Date('2026-05-06T14:30:00Z'),
      status: 'APPROVED',
      totalDistanceMeters: 45000,
      totalTravelMinutes: 65,
      totalVisitMinutes: 180,
      totalJobs: 2,
      totalHorses: 4,
      optimizationScore: 0.87,
      notes: 'Approved — Villeneuve (3 horses) then Aigle (1 horse, urgent).',
    },
  });
  console.log(`  Route: ${routeApproved.id} (APPROVED)`);

  const routeCompleted = await prisma.routeRun.upsert({
    where: { id: 'demo-route-completed' },
    update: {},
    create: {
      id: 'demo-route-completed',
      runDate: new Date('2026-04-10'),
      homeBaseAddress: 'Blonay, 1807, Switzerland',
      startTime: new Date('2026-04-10T08:30:00Z'),
      endTime: new Date('2026-04-10T12:00:00Z'),
      status: 'COMPLETED',
      totalDistanceMeters: 32000,
      totalTravelMinutes: 45,
      totalVisitMinutes: 150,
      totalJobs: 2,
      totalHorses: 4,
      optimizationScore: 0.91,
      notes: 'Completed — Bulle and Avenches area.',
    },
  });
  console.log(`  Route: ${routeCompleted.id} (COMPLETED)`);

  // Route stops for approved route
  await prisma.routeRunStop.upsert({
    where: { id: 'demo-stop-approved-1' },
    update: {},
    create: {
      id: 'demo-stop-approved-1',
      routeRunId: routeApproved.id,
      sequenceNo: 1,
      visitRequestId: visitBooked1.id,
      yardId: yardVilleneuve.id,
      plannedArrival: new Date('2026-05-06T08:30:00Z'),
      plannedDeparture: new Date('2026-05-06T10:30:00Z'),
      serviceMinutes: 120,
      travelFromPrevMinutes: 15,
      travelFromPrevMeters: 8000,
      stopStatus: 'CONFIRMED',
    },
  });

  await prisma.routeRunStop.upsert({
    where: { id: 'demo-stop-approved-2' },
    update: {},
    create: {
      id: 'demo-stop-approved-2',
      routeRunId: routeApproved.id,
      sequenceNo: 2,
      visitRequestId: visitBooked2.id,
      yardId: yardAigle.id,
      plannedArrival: new Date('2026-05-06T11:00:00Z'),
      plannedDeparture: new Date('2026-05-06T12:00:00Z'),
      serviceMinutes: 60,
      travelFromPrevMinutes: 20,
      travelFromPrevMeters: 15000,
      stopStatus: 'PLANNED',
    },
  });

  // Route stops for completed route
  await prisma.routeRunStop.upsert({
    where: { id: 'demo-stop-completed-1' },
    update: {},
    create: {
      id: 'demo-stop-completed-1',
      routeRunId: routeCompleted.id,
      sequenceNo: 1,
      visitRequestId: visitReview.id,
      yardId: yardBulle.id,
      plannedArrival: new Date('2026-04-10T09:00:00Z'),
      plannedDeparture: new Date('2026-04-10T10:30:00Z'),
      serviceMinutes: 90,
      travelFromPrevMinutes: 25,
      travelFromPrevMeters: 18000,
      stopStatus: 'COMPLETED',
    },
  });

  // ─── Appointments (5: various statuses) ──────────────────────────────────

  await prisma.appointment.upsert({
    where: { id: 'demo-appt-confirmed' },
    update: {
      status: 'CONFIRMED',
      confirmationChannel: 'WHATSAPP',
      confirmationSentAt: new Date('2026-04-14T10:00:00Z'),
      cancellationReason: null,
      reminderSentAt24h: null,
      reminderSentAt2h: null,
    },
    create: {
      id: 'demo-appt-confirmed',
      visitRequestId: visitBooked1.id,
      routeRunId: routeApproved.id,
      appointmentStart: new Date('2026-05-06T08:30:00Z'),
      appointmentEnd: new Date('2026-05-06T10:30:00Z'),
      status: 'CONFIRMED',
      confirmationChannel: 'WHATSAPP',
      confirmationSentAt: new Date('2026-04-14T10:00:00Z'),
    },
  });
  console.log('  Appointment: demo-appt-confirmed (CONFIRMED)');

  await prisma.appointment.upsert({
    where: { id: 'demo-appt-proposed' },
    update: {
      status: 'PROPOSED',
      cancellationReason: null,
      confirmationChannel: null,
      confirmationSentAt: null,
      reminderSentAt24h: null,
      reminderSentAt2h: null,
    },
    create: {
      id: 'demo-appt-proposed',
      visitRequestId: visitBooked2.id,
      routeRunId: routeApproved.id,
      appointmentStart: new Date('2026-05-06T11:00:00Z'),
      appointmentEnd: new Date('2026-05-06T12:00:00Z'),
      status: 'PROPOSED',
    },
  });
  console.log('  Appointment: demo-appt-proposed (PROPOSED)');

  await prisma.appointment.upsert({
    where: { id: 'demo-appt-completed' },
    update: {
      status: 'COMPLETED',
      confirmationChannel: 'PHONE',
      confirmationSentAt: new Date('2026-04-08T14:00:00Z'),
      cancellationReason: null,
    },
    create: {
      id: 'demo-appt-completed',
      visitRequestId: visitReview.id,
      routeRunId: routeCompleted.id,
      appointmentStart: new Date('2026-04-10T09:00:00Z'),
      appointmentEnd: new Date('2026-04-10T10:30:00Z'),
      status: 'COMPLETED',
      confirmationChannel: 'PHONE',
      confirmationSentAt: new Date('2026-04-08T14:00:00Z'),
    },
  });
  console.log('  Appointment: demo-appt-completed (COMPLETED)');

  // Visit outcome for the one completed appointment so the closed-loop
  // narrative on /completed and /appointments/demo-appt-completed shows
  // clinical notes, follow-up flag, next-due date, and invoice status.
  await prisma.visitOutcome.upsert({
    where: { appointmentId: 'demo-appt-completed' },
    update: {
      notes: 'Routine dental check — mild hooks on 107/207 rasped. Sedation: detomidine 5 mg IV. No further intervention required.',
      followUpRequired: false,
      followUpDueDate: null,
      nextDentalDueDate: new Date('2026-10-10T00:00:00Z'),
      invoiceStatus: 'PAID',
    },
    create: {
      id: 'demo-outcome-completed',
      appointmentId: 'demo-appt-completed',
      completedAt: new Date('2026-04-10T10:30:00Z'),
      notes: 'Routine dental check — mild hooks on 107/207 rasped. Sedation: detomidine 5 mg IV. No further intervention required.',
      followUpRequired: false,
      nextDentalDueDate: new Date('2026-10-10T00:00:00Z'),
      invoiceStatus: 'PAID',
    },
  });
  console.log('  VisitOutcome: demo-outcome-completed (linked to demo-appt-completed)');

  await prisma.appointment.upsert({
    where: { id: 'demo-appt-cancelled' },
    update: {
      status: 'CANCELLED',
      cancellationReason: 'Customer requested reschedule due to horse being unwell.',
      confirmationChannel: null,
      confirmationSentAt: null,
    },
    create: {
      id: 'demo-appt-cancelled',
      visitRequestId: visitPool1.id,
      appointmentStart: new Date('2026-04-20T09:00:00Z'),
      appointmentEnd: new Date('2026-04-20T10:30:00Z'),
      status: 'CANCELLED',
      cancellationReason: 'Customer requested reschedule due to horse being unwell.',
    },
  });
  console.log('  Appointment: demo-appt-cancelled (CANCELLED)');

  await prisma.appointment.upsert({
    where: { id: 'demo-appt-noshow' },
    update: {
      status: 'NO_SHOW',
      cancellationReason: null,
      confirmationChannel: null,
      confirmationSentAt: null,
    },
    create: {
      id: 'demo-appt-noshow',
      visitRequestId: visitPool2.id,
      appointmentStart: new Date('2026-04-15T14:00:00Z'),
      appointmentEnd: new Date('2026-04-15T16:00:00Z'),
      status: 'NO_SHOW',
    },
  });
  console.log('  Appointment: demo-appt-noshow (NO_SHOW)');

  // ─── Summary ─────────────────────────────────────────────────────────────


  // ── Triage Tasks ──────────────────────────────────────────
  console.log('  Seeding triage tasks...');

  await prisma.triageTask.upsert({
    where: { id: 'demo-triage-1' },
    update: {},
    create: {
      id: 'demo-triage-1',
      visitRequestId: 'demo-visit-booked-2',
      taskType: 'URGENT_REVIEW',
      status: 'OPEN',
      notes: 'Horse Mistral — not eating, drooling, oral pain. Urgent review needed.',
      dueAt: new Date(Date.now() - 3600000), // 1 hour ago — overdue
    },
  });

  await prisma.triageTask.upsert({
    where: { id: 'demo-triage-2' },
    update: {},
    create: {
      id: 'demo-triage-2',
      visitRequestId: 'demo-visit-review',
      taskType: 'CLARIFY_SYMPTOMS',
      status: 'OPEN',
      notes: 'Customer reported vague symptoms — need more details before scheduling.',
    },
  });

  await prisma.triageTask.upsert({
    where: { id: 'demo-triage-3' },
    update: {},
    create: {
      id: 'demo-triage-3',
      visitRequestId: 'demo-visit-pool-1',
      taskType: 'ASK_FOR_POSTCODE',
      status: 'OPEN',
      notes: 'Missing postcode for route planning — need to confirm yard address.',
    },
  });

  await prisma.triageTask.upsert({
    where: { id: 'demo-triage-4' },
    update: {},
    create: {
      id: 'demo-triage-4',
      visitRequestId: 'demo-visit-pool-2',
      taskType: 'ASK_HORSE_COUNT',
      status: 'IN_PROGRESS',
      notes: 'Customer mentioned "several horses" — need exact count for scheduling.',
    },
  });

  await prisma.triageTask.upsert({
    where: { id: 'demo-triage-5' },
    update: {},
    create: {
      id: 'demo-triage-5',
      visitRequestId: 'demo-visit-pool-3',
      taskType: 'MANUAL_CLASSIFICATION',
      status: 'OPEN',
      notes: 'Auto-triage confidence low (42%) — needs manual review.',
    },
  });


  console.log('\n═══ Demo Seed Summary ═══');
  console.log('  Customers: 8 (4 FR, 4 EN)');
  console.log('  Yards: 8 (Villeneuve, Montreux, Aigle, Château-d\'Oex, Bulle, Avenches, Lausanne, Nyon)');
  console.log('  Horses: 20');
  console.log('  Enquiries: 12 (NEW, PARSED, NEEDS_INFO, TRIAGED)');
  console.log('  Visit Requests: 8 (BOOKED, PLANNING_POOL, READY_FOR_REVIEW)');
  console.log('  Route Runs: 3 (1 DRAFT, 1 APPROVED, 1 COMPLETED)');
  console.log('  Appointments: 5 (CONFIRMED, PROPOSED, COMPLETED, CANCELLED, NO_SHOW)');
  console.log('  Triage Tasks: 5 (URGENT_REVIEW, CLARIFY, ASK_POSTCODE, ASK_HORSES, MANUAL)');
  console.log('  Visit Outcomes: 1 (linked to demo-appt-completed)');
  console.log('\nDemo seeding complete.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Demo seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
