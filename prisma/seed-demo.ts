import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Helpers ───────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/** Returns the given date capped at "now" — prevents future timestamps for
 *  confirmation/reminder fields on upcoming appointments. */
function atMostNow(d: Date): Date {
  return new Date(Math.min(Date.now(), d.getTime()));
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function atTime(base: Date, hours: number, minutes = 0): Date {
  const d = new Date(base);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const HORSE_NAMES_FR = [
  'Éclat', 'Bijou', 'Tonnerre', 'Mistral', 'Zénith', 'Orage', 'Cerise',
  'Duchesse', 'Prince', 'Étoile', 'Caramel', 'Papillon', 'Flocon', 'Tempête',
  'Réglisse', 'Soleil', 'Nuage', 'Perle', 'Rubis', 'Diamant', 'Cannelle',
  'Fougère', 'Aube', 'Brume', 'Noisette',
];
const HORSE_NAMES_EN = [
  'Bramble', 'Shadow', 'Alpine', 'Blaze', 'Fern', 'Comet', 'Tempest',
  'Luna', 'Apollo', 'Biscuit', 'Pepper', 'Storm', 'Willow', 'Clover',
  'Rosie', 'Oakley', 'Maple', 'Ginger', 'Scout', 'Ivy', 'Hazel',
  'Juniper', 'Sage', 'Thistle', 'Ember',
];

// ─── Types for structured data ─────────────────────────────────────────────

interface CustomerDef {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'PHONE';
  lang: 'en' | 'fr';
  notes: string;
}

interface YardDef {
  id: string;
  customerId: string;
  name: string;
  addr: string;
  town: string;
  county: string;
  postcode: string;
  lat: number;
  lng: number;
  access: string;
  area: string;
}

// ─── Main seed ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding demo database (comprehensive Swiss equine vet demo)...\n');

  // ══════════════════════════════════════════════════════════════════════════
  // 1. TEST PERSONAS — Auth User + Staff pairs
  // ══════════════════════════════════════════════════════════════════════════

  console.log('─── Test Personas ───');

  const personas = [
    {
      userId: 'demo-user-admin',
      staffId: 'demo-staff-admin',
      name: 'Dr. Rachel Kemp',
      email: 'rachel@equismile.demo',
      githubLogin: 'rachel-kemp',
      role: 'admin',
      staffRole: 'VET' as const,
      colour: '#9b214d',
      phone: '+41799100001',
      bio: 'Practice owner and lead equine dental vet. Full admin access.',
    },
    {
      userId: 'demo-user-senior-vet',
      staffId: 'demo-staff-senior-vet',
      name: 'Dr. Alex Moreau',
      email: 'alex@equismile.demo',
      githubLogin: 'alex-moreau',
      role: 'vet',
      staffRole: 'VET' as const,
      colour: '#1e40af',
      phone: '+41799100002',
      bio: 'Senior equine dental vet. Handles route planning and clinical records.',
    },
    {
      userId: 'demo-user-junior-vet',
      staffId: 'demo-staff-junior-vet',
      name: 'Dr. Sophie Laurent',
      email: 'sophie@equismile.demo',
      githubLogin: 'sophie-laurent',
      role: 'vet',
      staffRole: 'VET' as const,
      colour: '#7c3aed',
      phone: '+41799100003',
      bio: 'Junior vet / vet tech. Assists on rounds and records dental charts.',
    },
    {
      userId: 'demo-user-nurse',
      staffId: 'demo-staff-nurse',
      name: 'Léa Bertrand',
      email: 'lea@equismile.demo',
      githubLogin: 'lea-bertrand',
      role: 'nurse',
      staffRole: 'NURSE' as const,
      colour: '#16a34a',
      phone: '+41799100004',
      bio: 'Veterinary nurse. Creates customers, logs enquiries, manages bookings.',
    },
    {
      userId: 'demo-user-receptionist',
      staffId: 'demo-staff-receptionist',
      name: 'Marc Dubois',
      email: 'marc@equismile.demo',
      githubLogin: 'marc-dubois',
      role: 'readonly',
      staffRole: 'ADMIN' as const,
      colour: '#ea580c',
      phone: '+41799100005',
      bio: 'Receptionist. Read-only app access; views dashboards and schedules.',
    },
  ];

  for (const p of personas) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { role: p.role, name: p.name, githubLogin: p.githubLogin },
      create: {
        id: p.userId,
        email: p.email,
        name: p.name,
        githubLogin: p.githubLogin,
        role: p.role,
      },
    });

    await prisma.staff.upsert({
      where: { email: p.email },
      update: { userId: user.id, role: p.staffRole, colour: p.colour },
      create: {
        id: p.staffId,
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: p.staffRole,
        colour: p.colour,
        notes: p.bio,
        userId: user.id,
      },
    });

    console.log(`  ${p.name} — ${p.role} (${p.email})`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. CUSTOMERS (15: 8 FR, 7 EN)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n─── Customers ───');

  const customerDefs: CustomerDef[] = [
    { id: 'demo-cust-marie', fullName: 'Marie Dupont', phone: '+41799001234', email: 'marie.dupont@example.ch', channel: 'WHATSAPP', lang: 'fr', notes: 'Propriétaire de 5 chevaux à Villeneuve. Préfère le matin.' },
    { id: 'demo-cust-sarah', fullName: 'Sarah Mitchell', phone: '+41799002345', email: 'sarah.mitchell@example.com', channel: 'WHATSAPP', lang: 'en', notes: 'Expat in Montreux, 3 horses. Prefers English communication.' },
    { id: 'demo-cust-pierre', fullName: 'Pierre Rochat', phone: '+41799003456', email: 'pierre.rochat@example.ch', channel: 'EMAIL', lang: 'fr', notes: 'Éleveur à Aigle. Gère un haras de 6 chevaux.' },
    { id: 'demo-cust-emma', fullName: 'Emma Wilson', phone: '+41799004567', email: 'emma.wilson@example.com', channel: 'WHATSAPP', lang: 'en', notes: 'Runs a riding school near Château-d\'Oex. Very organised.' },
    { id: 'demo-cust-jeanluc', fullName: 'Jean-Luc Favre', phone: '+41799005678', email: 'jeanluc.favre@example.ch', channel: 'PHONE', lang: 'fr', notes: 'Agriculteur à Bulle. Préfère les appels téléphoniques.' },
    { id: 'demo-cust-rachel', fullName: 'Rachel Thompson', phone: '+41799006789', email: 'rachel.thompson@example.com', channel: 'EMAIL', lang: 'en', notes: 'British equestrian coach based in Avenches.' },
    { id: 'demo-cust-isabelle', fullName: 'Isabelle Moret', phone: '+41799007890', email: 'isabelle.moret@example.ch', channel: 'WHATSAPP', lang: 'fr', notes: 'Cavalière de compétition à Lausanne. 3 chevaux de dressage.' },
    { id: 'demo-cust-david', fullName: 'David Brown', phone: '+41799008901', email: 'david.brown@example.com', channel: 'WHATSAPP', lang: 'en', notes: 'Retired farmer near Nyon. 3 elderly horses.' },
    { id: 'demo-cust-claire', fullName: 'Claire Bonvin', phone: '+41799009012', email: 'claire.bonvin@example.ch', channel: 'EMAIL', lang: 'fr', notes: 'Éleveuse à Sion. Grand domaine avec 5 chevaux.' },
    { id: 'demo-cust-james', fullName: 'James Henderson', phone: '+41799010123', email: 'james.henderson@example.com', channel: 'WHATSAPP', lang: 'en', notes: 'Polo instructor at Gstaad. 4 polo ponies.' },
    { id: 'demo-cust-nicole', fullName: 'Nicole Perret', phone: '+41799011234', email: 'nicole.perret@example.ch', channel: 'WHATSAPP', lang: 'fr', notes: 'Centre équestre à Morges. 6 chevaux de club.' },
    { id: 'demo-cust-tom', fullName: 'Tom Baker', phone: '+41799012345', email: 'tom.baker@example.com', channel: 'EMAIL', lang: 'en', notes: 'Hobby breeder near Vevey. 2 young horses.' },
    { id: 'demo-cust-sophie', fullName: 'Sophie Blanc', phone: '+41799013456', email: 'sophie.blanc@example.ch', channel: 'PHONE', lang: 'fr', notes: 'Vétérinaire généraliste à Yverdon. Réfère les cas dentaires.' },
    { id: 'demo-cust-mark', fullName: 'Mark Stewart', phone: '+41799014567', email: 'mark.stewart@example.com', channel: 'WHATSAPP', lang: 'en', notes: 'Show jumping competitor based near Bex. 3 sport horses.' },
    { id: 'demo-cust-anne', fullName: 'Anne-Marie Roux', phone: '+41799015678', email: 'annemarie.roux@example.ch', channel: 'EMAIL', lang: 'fr', notes: 'Retraitée passionnée de chevaux. 2 poneys à Rolle.' },
  ];

  const customers: Record<string, { id: string; fullName: string }> = {};
  for (const c of customerDefs) {
    const cust = await prisma.customer.upsert({
      where: { email: c.email },
      update: {
        fullName: c.fullName,
        mobilePhone: c.phone,
        preferredChannel: c.channel,
        preferredLanguage: c.lang,
        notes: c.notes,
      },
      create: {
        id: c.id,
        fullName: c.fullName,
        mobilePhone: c.phone,
        email: c.email,
        preferredChannel: c.channel,
        preferredLanguage: c.lang,
        notes: c.notes,
      },
    });
    customers[c.id] = { id: cust.id, fullName: cust.fullName };
    console.log(`  ${cust.fullName} (${c.lang.toUpperCase()}) — ${c.channel}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. YARDS (12 with real Swiss addresses)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n─── Yards ───');

  const yardDefs: YardDef[] = [
    { id: 'demo-yard-villeneuve', customerId: 'demo-cust-marie', name: 'Écurie du Lac', addr: '12 Route du Lac', town: 'Villeneuve', county: 'Vaud', postcode: '1844', lat: 46.3970, lng: 6.9277, access: 'Entrée par le chemin de terre après le camping. Chien amical.', area: 'Villeneuve VD' },
    { id: 'demo-yard-montreux', customerId: 'demo-cust-sarah', name: 'Montreux Equestrian Centre', addr: '45 Avenue des Alpes', town: 'Montreux', county: 'Vaud', postcode: '1820', lat: 46.4312, lng: 6.9107, access: 'Main gate with keypad — code 7890.', area: 'Montreux' },
    { id: 'demo-yard-aigle', customerId: 'demo-cust-pierre', name: 'Haras de l\'Aigle', addr: '8 Chemin des Vignes', town: 'Aigle', county: 'Vaud', postcode: '1860', lat: 46.3180, lng: 6.9706, access: 'Portail électrique — sonner à l\'interphone.', area: 'Aigle' },
    { id: 'demo-yard-chateau-doex', customerId: 'demo-cust-emma', name: 'Alpine Riding School', addr: '3 Route de la Gare', town: 'Château-d\'Oex', county: 'Vaud', postcode: '1660', lat: 46.4747, lng: 7.1366, access: 'Narrow mountain road — no large trailers.', area: 'Château-d\'Oex' },
    { id: 'demo-yard-bulle', customerId: 'demo-cust-jeanluc', name: 'Ferme Favre', addr: '22 Route de Gruyères', town: 'Bulle', county: 'Fribourg', postcode: '1630', lat: 46.6193, lng: 7.0570, access: 'Ferme traditionnelle, se garer devant la grange.', area: 'Bulle' },
    { id: 'demo-yard-avenches', customerId: 'demo-cust-rachel', name: 'IENA Avenches Stables', addr: '15 Rue du Château', town: 'Avenches', county: 'Vaud', postcode: '1580', lat: 46.8820, lng: 7.0422, access: 'Near the national equestrian centre.', area: 'Avenches' },
    { id: 'demo-yard-lausanne', customerId: 'demo-cust-isabelle', name: 'Centre Équestre de Sauvabelin', addr: '5 Chemin de Sauvabelin', town: 'Lausanne', county: 'Vaud', postcode: '1018', lat: 46.5197, lng: 6.6323, access: 'Dans la forêt de Sauvabelin.', area: 'Lausanne' },
    { id: 'demo-yard-nyon', customerId: 'demo-cust-david', name: 'Paddock du Léman', addr: '9 Chemin des Pâquis', town: 'Nyon', county: 'Vaud', postcode: '1260', lat: 46.3833, lng: 6.2398, access: 'Small paddock behind the house.', area: 'Nyon' },
    { id: 'demo-yard-sion', customerId: 'demo-cust-claire', name: 'Domaine Bonvin', addr: '18 Route des Crêtes', town: 'Sion', county: 'Valais', postcode: '1950', lat: 46.2333, lng: 7.3607, access: 'Grand portail blanc — accès camion. Sonnette à droite.', area: 'Sion' },
    { id: 'demo-yard-gstaad', customerId: 'demo-cust-james', name: 'Gstaad Polo Fields', addr: '2 Promenade Platz', town: 'Saanen', county: 'Bern', postcode: '3792', lat: 46.4756, lng: 7.2867, access: 'Behind the polo grounds. Ask reception for access.', area: 'Gstaad' },
    { id: 'demo-yard-morges', customerId: 'demo-cust-nicole', name: 'Écurie de Morges', addr: '30 Rue du Port', town: 'Morges', county: 'Vaud', postcode: '1110', lat: 46.5107, lng: 6.4973, access: 'Centre équestre municipal, parking visiteurs.', area: 'Morges' },
    { id: 'demo-yard-rolle', customerId: 'demo-cust-anne', name: 'Les Poneys de Rolle', addr: '7 Chemin du Vignoble', town: 'Rolle', county: 'Vaud', postcode: '1180', lat: 46.4575, lng: 6.3391, access: 'Petit paddock après le vignoble. Calme requis.', area: 'Rolle' },
  ];

  const yards: Record<string, { id: string; name: string; customerId: string }> = {};
  for (const y of yardDefs) {
    const yard = await prisma.yard.upsert({
      where: { id: y.id },
      update: {
        customerId: y.customerId,
        yardName: y.name,
        addressLine1: y.addr,
        town: y.town,
        county: y.county,
        postcode: y.postcode,
        latitude: y.lat,
        longitude: y.lng,
        geocodeSource: 'demo-seed',
        geocodePrecision: 'ROOFTOP',
        accessNotes: y.access,
        areaLabel: y.area,
      },
      create: {
        id: y.id,
        customerId: y.customerId,
        yardName: y.name,
        addressLine1: y.addr,
        town: y.town,
        county: y.county,
        postcode: y.postcode,
        latitude: y.lat,
        longitude: y.lng,
        geocodedAt: new Date(),
        geocodeSource: 'demo-seed',
        geocodePrecision: 'ROOFTOP',
        accessNotes: y.access,
        areaLabel: y.area,
      },
    });
    yards[y.id] = { id: yard.id, name: yard.yardName, customerId: y.customerId };
    console.log(`  ${yard.yardName} — ${y.town} (${y.postcode})`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. HORSES (49 across 12 yards)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n─── Horses ───');

  const horseDefs: Array<{
    id: string;
    name: string;
    age: number;
    customerId: string;
    yardId: string;
    notes: string;
    dueInDays: number;
  }> = [];

  const yardHorseCounts: Record<string, { custId: string; count: number; lang: 'en' | 'fr' }> = {
    'demo-yard-villeneuve': { custId: 'demo-cust-marie', count: 5, lang: 'fr' },
    'demo-yard-montreux': { custId: 'demo-cust-sarah', count: 3, lang: 'en' },
    'demo-yard-aigle': { custId: 'demo-cust-pierre', count: 6, lang: 'fr' },
    'demo-yard-chateau-doex': { custId: 'demo-cust-emma', count: 5, lang: 'en' },
    'demo-yard-bulle': { custId: 'demo-cust-jeanluc', count: 3, lang: 'fr' },
    'demo-yard-avenches': { custId: 'demo-cust-rachel', count: 4, lang: 'en' },
    'demo-yard-lausanne': { custId: 'demo-cust-isabelle', count: 3, lang: 'fr' },
    'demo-yard-nyon': { custId: 'demo-cust-david', count: 3, lang: 'en' },
    'demo-yard-sion': { custId: 'demo-cust-claire', count: 5, lang: 'fr' },
    'demo-yard-gstaad': { custId: 'demo-cust-james', count: 4, lang: 'en' },
    'demo-yard-morges': { custId: 'demo-cust-nicole', count: 6, lang: 'fr' },
    'demo-yard-rolle': { custId: 'demo-cust-anne', count: 2, lang: 'fr' },
  };

  const frNames = [...HORSE_NAMES_FR];
  const enNames = [...HORSE_NAMES_EN];
  let horseIdx = 0;

  const notesPool = [
    'Annual routine check.',
    'History of sharp enamel points.',
    'Sensitive mouth — light sedation recommended.',
    'Young horse, first full dental exam.',
    'Older horse, check for periodontal disease.',
    'Competition horse — pre-season dental.',
    'Calm temperament, straightforward work.',
    'Known diastema on lower left.',
    'Previous wolf tooth extraction.',
    'Cushing\'s disease — gentle handling.',
  ];
  const notesFr = [
    'Contrôle annuel de routine.',
    'Historique de pointes d\'émail.',
    'Bouche sensible — sédation légère recommandée.',
    'Jeune cheval, premier examen complet.',
    'Cheval âgé, vérifier la maladie parodontale.',
    'Cheval de compétition — dentaire pré-saison.',
    'Tempérament calme, travail simple.',
    'Diastème connu en bas à gauche.',
    'Extraction antérieure de dent de loup.',
    'Maladie de Cushing — manipulation douce.',
  ];

  for (const [yardId, info] of Object.entries(yardHorseCounts)) {
    const pool = info.lang === 'fr' ? frNames : enNames;
    const notesArr = info.lang === 'fr' ? notesFr : notesPool;
    for (let i = 0; i < info.count; i++) {
      const name = pool.length > 0 ? pool.shift()! : `Horse-${horseIdx}`;
      const age = 3 + Math.floor(Math.random() * 20);
      horseDefs.push({
        id: `demo-horse-${String(horseIdx).padStart(3, '0')}`,
        name,
        age,
        customerId: info.custId,
        yardId,
        notes: notesArr[i % notesArr.length],
        dueInDays: -30 + Math.floor(Math.random() * 120),
      });
      horseIdx++;
    }
  }

  const horses: Array<{ id: string; name: string; customerId: string; yardId: string }> = [];
  for (const h of horseDefs) {
    await prisma.horse.upsert({
      where: { id: h.id },
      update: {
        customerId: h.customerId,
        primaryYardId: h.yardId,
        horseName: h.name,
        age: h.age,
        active: true,
      },
      create: {
        id: h.id,
        customerId: h.customerId,
        primaryYardId: h.yardId,
        horseName: h.name,
        age: h.age,
        notes: h.notes,
        dentalDueDate: daysFromNow(h.dueInDays),
        active: true,
      },
    });
    horses.push({ id: h.id, name: h.name, customerId: h.customerId, yardId: h.yardId });
  }
  console.log(`  Created ${horses.length} horses across ${Object.keys(yardHorseCounts).length} yards`);

  // ══════════════════════════════════════════════════════════════════════════
  // 5. ENQUIRIES (25: mix of stages)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n─── Enquiries ───');

  const triageStatuses = ['TRIAGED', 'TRIAGED', 'TRIAGED', 'TRIAGED', 'TRIAGED',
    'TRIAGED', 'TRIAGED', 'TRIAGED', 'TRIAGED', 'TRIAGED',
    'TRIAGED', 'TRIAGED', 'TRIAGED', 'TRIAGED', 'TRIAGED',
    'NEW', 'NEW', 'NEW', 'PARSED', 'PARSED',
    'NEEDS_INFO', 'NEEDS_INFO', 'NEEDS_INFO', 'NEW', 'PARSED'] as const;

  const messagesEN = [
    'Hi, I need to book dental checks for my horses.',
    'Hello, one of my horses is having trouble eating. Can you come this week?',
    'Annual dental checkup needed for all horses at our yard.',
    'My horse has been dropping food — possible dental issue?',
    'Would like to schedule routine dental work for the spring.',
    'Urgent: horse in severe pain, not eating for 2 days.',
    'Need dental work before competition season starts.',
    'Follow-up check requested after previous treatment.',
    'New horse just arrived — needs initial dental assessment.',
    'Multiple horses need routine checks — can we batch them?',
    'My old horse needs gentle dental care.',
    'Please schedule annual checks for my riding school horses.',
    'Horse seems uncomfortable with the bit — dental check needed?',
  ];
  const messagesFR = [
    'Bonjour, je souhaite prendre rendez-vous pour un contrôle dentaire.',
    'Mon cheval ne mange plus bien. Pouvez-vous venir cette semaine?',
    'Contrôle dentaire annuel nécessaire pour tous les chevaux.',
    'Mon cheval laisse tomber sa nourriture — problème dentaire possible?',
    'Je souhaite planifier un contrôle dentaire de printemps.',
    'Urgence: cheval très douloureux, ne mange plus depuis 2 jours.',
    'Travail dentaire nécessaire avant la saison de compétition.',
    'Contrôle de suivi demandé après le traitement précédent.',
    'Nouveau cheval — besoin d\'un bilan dentaire initial.',
    'Plusieurs chevaux à contrôler — peut-on les grouper?',
    'Mon vieux cheval a besoin de soins dentaires doux.',
    'Contrôle annuel pour les chevaux du centre équestre svp.',
  ];

  const enquiryIds: string[] = [];
  const customerList = Object.values(customers);
  const yardList = Object.values(yards);
  // Enquiries beyond this index are NEW with no customer/yard — simulating
  // raw inbound messages that haven't been linked to a customer yet.
  const UNLINKED_ENQUIRY_THRESHOLD = 18;

  for (let i = 0; i < 25; i++) {
    const id = `demo-enquiry-${String(i + 1).padStart(3, '0')}`;
    const cust = customerList[i % customerList.length];
    const custDef = customerDefs.find(c => c.id === cust.id)!;
    const yard = yardList.find(y => y.customerId === cust.id) ?? yardList[i % yardList.length];
    const isFr = custDef?.lang === 'fr';
    const msgs = isFr ? messagesFR : messagesEN;
    const channel = i % 3 === 0 ? 'EMAIL' as const : 'WHATSAPP' as const;
    const status = triageStatuses[i];
    const dAgo = 360 - (i * 14);
    const isUnlinked = status === 'NEW' && i > UNLINKED_ENQUIRY_THRESHOLD;

    await prisma.enquiry.upsert({
      where: { id },
      update: {
        customerId: isUnlinked ? null : cust.id,
        yardId: isUnlinked ? null : yard.id,
        triageStatus: status,
        rawText: msgs[i % msgs.length],
        subject: msgs[i % msgs.length].substring(0, 60),
      },
      create: {
        id,
        channel,
        externalMessageId: channel === 'EMAIL' ? `<${id}@example.com>` : `wamid.${id}`,
        customerId: isUnlinked ? null : cust.id,
        yardId: isUnlinked ? null : yard.id,
        sourceFrom: channel === 'EMAIL' ? custDef.email : custDef.phone,
        subject: msgs[i % msgs.length].substring(0, 60),
        rawText: msgs[i % msgs.length],
        receivedAt: daysAgo(Math.max(1, dAgo)),
        triageStatus: status,
      },
    });
    enquiryIds.push(id);

    // Add message thread
    await prisma.enquiryMessage.upsert({
      where: { id: `${id}-msg-1` },
      update: {},
      create: {
        id: `${id}-msg-1`,
        enquiryId: id,
        direction: 'INBOUND',
        channel,
        messageText: msgs[i % msgs.length],
        sentOrReceivedAt: daysAgo(Math.max(1, dAgo)),
      },
    });

    if (status === 'TRIAGED' || status === 'NEEDS_INFO') {
      const replyText = isFr
        ? 'Merci pour votre message. Nous vous recontacterons rapidement.'
        : 'Thank you for your message. We\'ll get back to you shortly.';
      await prisma.enquiryMessage.upsert({
        where: { id: `${id}-msg-2` },
        update: {},
        create: {
          id: `${id}-msg-2`,
          enquiryId: id,
          direction: 'OUTBOUND',
          channel,
          messageText: replyText,
          sentOrReceivedAt: daysAgo(Math.max(0, dAgo - 1)),
        },
      });
    }
  }
  console.log(`  Created ${enquiryIds.length} enquiries with message threads`);

  // ══════════════════════════════════════════════════════════════════════════
  // 6. VISIT REQUESTS (20: spanning pipeline stages)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n─── Visit Requests ───');

  const requestTypes = ['ROUTINE_DENTAL', 'ROUTINE_DENTAL', 'ROUTINE_DENTAL', 'FOLLOW_UP',
    'URGENT_ISSUE', 'FIRST_VISIT', 'ROUTINE_DENTAL', 'ROUTINE_DENTAL'] as const;
  const urgencies = ['ROUTINE', 'ROUTINE', 'ROUTINE', 'SOON', 'URGENT', 'ROUTINE', 'ROUTINE', 'SOON'] as const;
  const planningStatuses = [
    'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED',  // 4 completed
    'BOOKED', 'BOOKED', 'BOOKED',                         // 3 booked
    'PROPOSED',                                            // 1 proposed
    'PLANNING_POOL', 'PLANNING_POOL', 'PLANNING_POOL', 'PLANNING_POOL', 'PLANNING_POOL', 'PLANNING_POOL', // 6 in pool
    'READY_FOR_REVIEW', 'READY_FOR_REVIEW',                // 2 ready
    'CLUSTERED',                                           // 1 clustered
    'UNTRIAGED', 'UNTRIAGED', 'UNTRIAGED',                 // 3 untriaged
  ] as const;

  type PlanningStatus = typeof planningStatuses[number];

  const visitIds: Array<{ id: string; customerId: string; yardId: string; status: PlanningStatus }> = [];

  for (let i = 0; i < 20; i++) {
    const id = `demo-visit-${String(i + 1).padStart(3, '0')}`;
    const custId = customerDefs[i % customerDefs.length].id;
    const yard = yardList.find(y => y.customerId === custId) ?? yardList[i % yardList.length];
    const reqType = requestTypes[i % requestTypes.length];
    const urgency = urgencies[i % urgencies.length];
    const planning = planningStatuses[i];
    const horseCount = 1 + Math.floor(Math.random() * 4);

    await prisma.visitRequest.upsert({
      where: { id },
      update: { planningStatus: planning },
      create: {
        id,
        enquiryId: i < enquiryIds.length ? enquiryIds[i] : null,
        customerId: custId,
        yardId: yard.id,
        requestType: reqType,
        urgencyLevel: urgency,
        clinicalFlags: urgency === 'URGENT' ? ['not eating', 'oral pain'] : [],
        horseCount,
        specificHorses: [],
        preferredDays: ['Monday', 'Wednesday', 'Friday'],
        preferredTimeBand: 'AM',
        earliestBookDate: daysAgo(30),
        latestBookDate: daysFromNow(60),
        planningStatus: planning,
        estimatedDurationMinutes: horseCount * 40,
        autoTriageConfidence: 0.75 + Math.random() * 0.20,
      },
    });
    visitIds.push({ id, customerId: custId, yardId: yard.id, status: planning });
  }
  console.log(`  Created ${visitIds.length} visit requests`);

  // ══════════════════════════════════════════════════════════════════════════
  // 7. TRIAGE TASKS (8)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n─── Triage Tasks ───');

  const triageTaskDefs = [
    { id: 'demo-triage-001', vrId: 'demo-visit-005', type: 'URGENT_REVIEW' as const, status: 'OPEN' as const, notes: 'Urgent — horse not eating. Review immediately.' },
    { id: 'demo-triage-002', vrId: 'demo-visit-015', type: 'CLARIFY_SYMPTOMS' as const, status: 'OPEN' as const, notes: 'Customer reported vague symptoms — need details.' },
    { id: 'demo-triage-003', vrId: 'demo-visit-009', type: 'ASK_FOR_POSTCODE' as const, status: 'OPEN' as const, notes: 'Missing postcode for route planning.' },
    { id: 'demo-triage-004', vrId: 'demo-visit-010', type: 'ASK_HORSE_COUNT' as const, status: 'IN_PROGRESS' as const, notes: 'Customer mentioned "several horses" — need exact count.' },
    { id: 'demo-triage-005', vrId: 'demo-visit-011', type: 'MANUAL_CLASSIFICATION' as const, status: 'OPEN' as const, notes: 'Auto-triage confidence low (42%) — manual review.' },
    { id: 'demo-triage-006', vrId: 'demo-visit-016', type: 'CLARIFY_SYMPTOMS' as const, status: 'OPEN' as const, notes: 'Unclear if this is routine or needs urgent review.' },
    { id: 'demo-triage-007', vrId: 'demo-visit-018', type: 'ASK_FOR_POSTCODE' as const, status: 'OPEN' as const, notes: 'New customer — no address on file yet.' },
    { id: 'demo-triage-008', vrId: 'demo-visit-019', type: 'MANUAL_CLASSIFICATION' as const, status: 'DONE' as const, notes: 'Classified as routine dental after review.' },
  ];

  for (const t of triageTaskDefs) {
    await prisma.triageTask.upsert({
      where: { id: t.id },
      update: {
        status: t.status,
        notes: t.notes,
        taskType: t.type,
      },
      create: {
        id: t.id,
        visitRequestId: t.vrId,
        taskType: t.type,
        status: t.status,
        notes: t.notes,
        dueAt: t.type === 'URGENT_REVIEW' ? daysAgo(0) : daysFromNow(3),
      },
    });
  }
  console.log(`  Created ${triageTaskDefs.length} triage tasks`);

  // ══════════════════════════════════════════════════════════════════════════
  // 8. ROUTE RUNS (8: covering 12 months of history + upcoming)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n─── Route Runs ───');

  const routeRunDefs = [
    { id: 'demo-route-001', date: daysAgo(330), status: 'COMPLETED' as const, dist: 72000, travel: 95, service: 280, jobs: 4, horseCount: 10, score: 0.89, notes: 'Winter round — Villeneuve, Montreux, Aigle.' },
    { id: 'demo-route-002', date: daysAgo(270), status: 'COMPLETED' as const, dist: 55000, travel: 70, service: 240, jobs: 3, horseCount: 8, score: 0.91, notes: 'Spring round — Bulle, Avenches, Lausanne.' },
    { id: 'demo-route-003', date: daysAgo(200), status: 'COMPLETED' as const, dist: 48000, travel: 60, service: 200, jobs: 3, horseCount: 7, score: 0.88, notes: 'Summer round — Nyon, Morges, Rolle.' },
    { id: 'demo-route-004', date: daysAgo(140), status: 'COMPLETED' as const, dist: 95000, travel: 130, service: 360, jobs: 5, horseCount: 14, score: 0.85, notes: 'Autumn big round — Sion, Gstaad, Château-d\'Oex area.' },
    { id: 'demo-route-005', date: daysAgo(60), status: 'COMPLETED' as const, dist: 42000, travel: 55, service: 180, jobs: 3, horseCount: 6, score: 0.92, notes: 'Recent round — Montreux corridor.' },
    { id: 'demo-route-006', date: daysAgo(5), status: 'APPROVED' as const, dist: 65000, travel: 85, service: 300, jobs: 4, horseCount: 11, score: 0.87, notes: 'This week — Lausanne, Morges, Nyon, Rolle.' },
    { id: 'demo-route-007', date: daysFromNow(7), status: 'DRAFT' as const, dist: 78000, travel: 100, service: 260, jobs: 3, horseCount: 9, score: 0.83, notes: 'Next week — Villeneuve, Aigle, Sion area.' },
    { id: 'demo-route-008', date: daysFromNow(14), status: 'DRAFT' as const, dist: 58000, travel: 75, service: 220, jobs: 3, horseCount: 8, score: 0.86, notes: 'Upcoming — Bulle, Gstaad, Château-d\'Oex.' },
  ];

  for (const r of routeRunDefs) {
    await prisma.routeRun.upsert({
      where: { id: r.id },
      update: {
        status: r.status,
        totalDistanceMeters: r.dist,
        totalTravelMinutes: r.travel,
        totalVisitMinutes: r.service,
        totalJobs: r.jobs,
        totalHorses: r.horseCount,
        optimizationScore: r.score,
        notes: r.notes,
      },
      create: {
        id: r.id,
        runDate: r.date,
        homeBaseAddress: 'Blonay, 1807, Switzerland',
        startTime: atTime(r.date, 8, 0),
        endTime: atTime(r.date, 8 + Math.floor((r.travel + r.service) / 60), (r.travel + r.service) % 60),
        status: r.status,
        totalDistanceMeters: r.dist,
        totalTravelMinutes: r.travel,
        totalVisitMinutes: r.service,
        totalJobs: r.jobs,
        totalHorses: r.horseCount,
        optimizationScore: r.score,
        notes: r.notes,
        leadStaffId: 'demo-staff-admin',
      },
    });
    console.log(`  Route ${r.id} — ${r.status} (${r.notes.substring(0, 50)})`);
  }

  // Route stops for the approved route
  const approvedStopYards = ['demo-yard-lausanne', 'demo-yard-morges', 'demo-yard-nyon', 'demo-yard-rolle'];
  for (let s = 0; s < approvedStopYards.length; s++) {
    const yardId = approvedStopYards[s];
    const matchVisit = visitIds.find(v => v.yardId === yardId && (v.status === 'BOOKED' || v.status === 'PLANNING_POOL'));
    await prisma.routeRunStop.upsert({
      where: { id: `demo-stop-006-${s + 1}` },
      update: {},
      create: {
        id: `demo-stop-006-${s + 1}`,
        routeRunId: 'demo-route-006',
        sequenceNo: s + 1,
        visitRequestId: matchVisit?.id ?? null,
        yardId,
        plannedArrival: atTime(daysAgo(5), 8 + s, 30),
        plannedDeparture: atTime(daysAgo(5), 9 + s, 15),
        serviceMinutes: 45 + Math.floor(Math.random() * 30),
        travelFromPrevMinutes: 15 + Math.floor(Math.random() * 15),
        travelFromPrevMeters: 8000 + Math.floor(Math.random() * 10000),
        stopStatus: 'CONFIRMED',
      },
    });
  }

  // Route stops for completed routes
  for (let ri = 0; ri < 5; ri++) {
    const routeId = `demo-route-${String(ri + 1).padStart(3, '0')}`;
    const routeDef = routeRunDefs[ri];
    for (let s = 0; s < routeDef.jobs; s++) {
      const yardId = yardDefs[(ri * 3 + s) % yardDefs.length].id;
      await prisma.routeRunStop.upsert({
        where: { id: `demo-stop-${String(ri + 1).padStart(3, '0')}-${s + 1}` },
        update: {},
        create: {
          id: `demo-stop-${String(ri + 1).padStart(3, '0')}-${s + 1}`,
          routeRunId: routeId,
          sequenceNo: s + 1,
          yardId,
          plannedArrival: atTime(routeDef.date, 8 + s, 30),
          plannedDeparture: atTime(routeDef.date, 9 + s, 15),
          serviceMinutes: 60 + Math.floor(Math.random() * 30),
          travelFromPrevMinutes: 15 + Math.floor(Math.random() * 20),
          travelFromPrevMeters: 5000 + Math.floor(Math.random() * 15000),
          stopStatus: 'COMPLETED',
        },
      });
    }
  }
  console.log('  Created route stops for all routes');

  // ══════════════════════════════════════════════════════════════════════════
  // 9. APPOINTMENTS (18: historical + upcoming across 12 months)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n─── Appointments ───');

  const apptStatuses = [
    'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED',
    'COMPLETED', 'COMPLETED', 'COMPLETED',
    'CONFIRMED', 'CONFIRMED', 'CONFIRMED',
    'PROPOSED', 'PROPOSED',
    'NO_SHOW',
    'CANCELLED', 'CANCELLED',
    'PROPOSED', 'CONFIRMED',
  ] as const;

  const apptDaysAgo = [
    330, 310, 270, 250, 200, 180, 140, 60,
    5, 4, 3,
    -7, -10,
    90,
    45, 20,
    -14, -3,
  ];

  for (let i = 0; i < 18; i++) {
    const id = `demo-appt-${String(i + 1).padStart(3, '0')}`;
    const status = apptStatuses[i];
    const d = apptDaysAgo[i];
    const base = d >= 0 ? daysAgo(d) : daysFromNow(-d);
    const visitIdx = i % visitIds.length;
    const routeIdx = i < 8 ? i % 5 : (i < 11 ? 5 : (i < 13 ? 6 : i % 8));

    await prisma.appointment.upsert({
      where: { id },
      update: { status },
      create: {
        id,
        visitRequestId: visitIds[visitIdx].id,
        routeRunId: `demo-route-${String(routeIdx + 1).padStart(3, '0')}`,
        appointmentStart: atTime(base, 8 + (i % 6), 0),
        appointmentEnd: atTime(base, 9 + (i % 6), 30),
        status,
        confirmationChannel: status === 'COMPLETED' || status === 'CONFIRMED' ? randomPick(['WHATSAPP', 'EMAIL', 'PHONE'] as const) : null,
        confirmationSentAt: status === 'COMPLETED' || status === 'CONFIRMED' ? atMostNow(daysAgo(d + 3)) : null,
        reminderSentAt24h: status === 'COMPLETED' || status === 'CONFIRMED' ? atMostNow(daysAgo(d + 1)) : null,
        reminderSentAt2h: status === 'COMPLETED' ? atMostNow(daysAgo(d)) : null,
        cancellationReason: status === 'CANCELLED' ? 'Customer requested reschedule.' : null,
      },
    });

    // Visit outcomes for completed appointments
    if (status === 'COMPLETED') {
      await prisma.visitOutcome.upsert({
        where: { appointmentId: id },
        update: {},
        create: {
          id: `demo-outcome-${String(i + 1).padStart(3, '0')}`,
          appointmentId: id,
          completedAt: atTime(base, 10 + (i % 4), 0),
          notes: randomPick([
            'All horses in good dental health. Minor floating performed.',
            'Sharp enamel points found and corrected. Light sedation used.',
            'Routine check complete. Recommended follow-up in 12 months.',
            'Diastema found on lower left — monitor at next visit.',
            'Wolf tooth extracted under sedation. Recovery uneventful.',
            'Periodontal disease detected — started treatment plan.',
            'Full mouth balance performed. Horse responded well.',
            'Hooks on upper arcade reduced. Good compliance.',
          ]),
          followUpRequired: i % 3 === 0,
          followUpDueDate: i % 3 === 0 ? daysFromNow(30 + i * 10) : null,
          nextDentalDueDate: daysFromNow(300 + i * 15),
          invoiceStatus: randomPick(['SENT', 'PAID', 'PAID', 'PENDING'] as const),
        },
      });
    }
  }
  console.log(`  Created 18 appointments (8 completed with outcomes, 4 confirmed, 3 proposed, 1 no-show, 2 cancelled)`);

  // Appointment assignments
  for (let i = 0; i < 18; i++) {
    const apptId = `demo-appt-${String(i + 1).padStart(3, '0')}`;
    await prisma.appointmentAssignment.upsert({
      where: { id: `demo-assign-${String(i + 1).padStart(3, '0')}` },
      update: {},
      create: {
        id: `demo-assign-${String(i + 1).padStart(3, '0')}`,
        appointmentId: apptId,
        staffId: i % 2 === 0 ? 'demo-staff-admin' : 'demo-staff-senior-vet',
        primary: true,
      },
    });
    if (i % 4 === 0) {
      await prisma.appointmentAssignment.upsert({
        where: { id: `demo-assign-${String(i + 1).padStart(3, '0')}-assist` },
        update: {},
        create: {
          id: `demo-assign-${String(i + 1).padStart(3, '0')}-assist`,
          appointmentId: apptId,
          staffId: 'demo-staff-nurse',
          primary: false,
        },
      });
    }
  }
  console.log('  Created appointment assignments');

  // Confirmation dispatches for confirmed/completed
  for (let i = 0; i < 18; i++) {
    const status = apptStatuses[i];
    if (status === 'COMPLETED' || status === 'CONFIRMED') {
      const apptId = `demo-appt-${String(i + 1).padStart(3, '0')}`;
      const d = apptDaysAgo[i];
      await prisma.confirmationDispatch.upsert({
        where: { id: `demo-dispatch-${String(i + 1).padStart(3, '0')}` },
        update: {},
        create: {
          id: `demo-dispatch-${String(i + 1).padStart(3, '0')}`,
          appointmentId: apptId,
          channel: randomPick(['WHATSAPP', 'EMAIL'] as const),
          sentAt: atMostNow(daysAgo(d + 2)),
          success: true,
          externalMessageId: `demo-ext-msg-${i}`,
        },
      });
    }
  }
  console.log('  Created confirmation dispatches');

  // Status history for completed appointments
  for (let i = 0; i < 8; i++) {
    const apptId = `demo-appt-${String(i + 1).padStart(3, '0')}`;
    const d = apptDaysAgo[i];
    const transitions: Array<{ from: 'PROPOSED' | 'CONFIRMED' | null; to: 'PROPOSED' | 'CONFIRMED' | 'COMPLETED' }> = [
      { from: null, to: 'PROPOSED' },
      { from: 'PROPOSED', to: 'CONFIRMED' },
      { from: 'CONFIRMED', to: 'COMPLETED' },
    ];
    for (let t = 0; t < transitions.length; t++) {
      await prisma.appointmentStatusHistory.upsert({
        where: { id: `demo-history-${String(i + 1).padStart(3, '0')}-${t + 1}` },
        update: {},
        create: {
          id: `demo-history-${String(i + 1).padStart(3, '0')}-${t + 1}`,
          appointmentId: apptId,
          fromStatus: transitions[t].from,
          toStatus: transitions[t].to,
          changedBy: 'demo-vet',
          reason: t === 2 ? 'Visit completed successfully.' : undefined,
          changedAt: daysAgo(d + (3 - t)),
        },
      });
    }
  }
  console.log('  Created appointment status history');

  // ══════════════════════════════════════════════════════════════════════════
  // 10. CLINICAL RECORDS — dental charts, findings, prescriptions
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n─── Clinical Records ───');

  const findingCategories = ['HOOK', 'WAVE', 'RAMP', 'DIASTEMA', 'EOTRH', 'FRACTURE', 'CARIES', 'WEAR', 'MISSING', 'OTHER'] as const;
  const severities = ['MILD', 'MODERATE', 'SEVERE'] as const;
  const toothIds = ['106', '206', '306', '406', '107', '207', '307', '407', '108', '208', '308', '408', '109', '209', '309'];
  const findingDescs = [
    'Sharp enamel point on buccal surface.',
    'Hook on upper arcade — reduce at next visit.',
    'Mild wave complex developing — monitor.',
    'Diastema between 306-307 — food packing noted.',
    'Early EOTRH signs on incisors — radiographs recommended.',
    'Old fracture line, stable — no intervention needed.',
    'Peripheral caries on 108 — clean and monitor.',
    'Excessive wear on tables — adjust diet if possible.',
    'Missing 209 (previously extracted) — no issues.',
    'Mild gingivitis along gum line — will resolve with floating.',
  ];

  let chartCount = 0;
  let findingCount = 0;
  let prescriptionCount = 0;

  for (let hi = 0; hi < Math.min(horses.length, 30); hi++) {
    const horse = horses[hi];
    const numCharts = 1 + Math.floor(Math.random() * 2);

    for (let ci = 0; ci < numCharts; ci++) {
      const chartId = `demo-chart-${String(hi).padStart(3, '0')}-${ci + 1}`;
      const recordDate = daysAgo(365 - ci * 180);

      await prisma.dentalChart.upsert({
        where: { id: chartId },
        update: {},
        create: {
          id: chartId,
          horseId: horse.id,
          recordedById: randomPick(['demo-staff-admin', 'demo-staff-senior-vet', 'demo-staff-junior-vet']),
          recordedAt: recordDate,
          generalNotes: randomPick([
            'Full mouth examination performed. Light sedation administered.',
            'Routine dental float. All quadrants checked.',
            'Annual exam — mild issues found, corrected on-site.',
            'Follow-up from previous visit. Improvement noted.',
            'Competition pre-season dental. Bit seating checked.',
          ]),
        },
      });
      chartCount++;

      const numFindings = 1 + Math.floor(Math.random() * 3);
      for (let fi = 0; fi < numFindings; fi++) {
        const findingId = `demo-finding-${String(hi).padStart(3, '0')}-${ci + 1}-${fi + 1}`;
        await prisma.clinicalFinding.upsert({
          where: { id: findingId },
          update: {},
          create: {
            id: findingId,
            horseId: horse.id,
            dentalChartId: chartId,
            findingDate: recordDate,
            toothId: randomPick(toothIds),
            category: randomPick([...findingCategories]),
            severity: randomPick([...severities]),
            description: randomPick(findingDescs),
            createdById: randomPick(['demo-staff-admin', 'demo-staff-senior-vet', 'demo-staff-junior-vet']),
          },
        });
        findingCount++;
      }
    }

    // Prescriptions for ~40% of horses
    if (hi % 3 === 0) {
      const rxId = `demo-rx-${String(hi).padStart(3, '0')}`;
      await prisma.prescription.upsert({
        where: { id: rxId },
        update: {},
        create: {
          id: rxId,
          horseId: horse.id,
          prescribedById: randomPick(['demo-staff-admin', 'demo-staff-senior-vet']),
          prescribedAt: daysAgo(30 + hi * 10),
          medicineName: randomPick([
            'Phenylbutazone (Bute)',
            'Flunixin meglumine (Banamine)',
            'Detomidine HCl',
            'Chlorhexidine oral rinse',
            'Metronidazole',
          ]),
          dosage: randomPick([
            '2.2 mg/kg PO BID for 3 days',
            '1.1 mg/kg IV once',
            '0.02 mg/kg IV — sedation for procedure',
            'Rinse affected area daily for 7 days',
            '15 mg/kg PO BID for 5 days',
          ]),
          durationDays: randomPick([3, 5, 7, 14]),
          withdrawalPeriodDays: randomPick([0, 7, 14, 28]),
          instructions: randomPick([
            'Administer with feed. Monitor for GI upset.',
            'Single dose — observe for 30 minutes post-administration.',
            'Sedation for dental procedure only.',
            'Use provided syringe to flush diastema.',
            'Complete full course. Do not discontinue early.',
          ]),
          status: randomPick(['ACTIVE', 'COMPLETED', 'COMPLETED', 'COMPLETED'] as const),
        },
      });
      prescriptionCount++;
    }
  }
  console.log(`  Created ${chartCount} dental charts, ${findingCount} clinical findings, ${prescriptionCount} prescriptions`);

  // ══════════════════════════════════════════════════════════════════════════
  // 11. TRIAGE AUDIT LOGS (sample)
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n─── Audit Logs ───');

  for (let i = 0; i < 10; i++) {
    await prisma.triageAuditLog.upsert({
      where: { id: `demo-audit-${String(i + 1).padStart(3, '0')}` },
      update: {},
      create: {
        id: `demo-audit-${String(i + 1).padStart(3, '0')}`,
        visitRequestId: `demo-visit-${String((i % 15) + 1).padStart(3, '0')}`,
        action: randomPick(['URGENCY_OVERRIDE', 'STATUS_CHANGE', 'TYPE_OVERRIDE', 'FORCE_TO_POOL']),
        field: randomPick(['urgencyLevel', 'planningStatus', 'requestType']),
        previousValue: randomPick(['ROUTINE', 'UNTRIAGED', 'ROUTINE_DENTAL']),
        newValue: randomPick(['URGENT', 'PLANNING_POOL', 'URGENT_ISSUE', 'SOON']),
        reason: randomPick([
          'Customer reported escalating symptoms.',
          'Auto-triage confidence too low — manual override.',
          'Multi-horse yard bumped priority for efficiency.',
          'Follow-up overdue — escalated.',
        ]),
        performedBy: randomPick(['rachel-kemp', 'alex-moreau']),
        createdAt: daysAgo(Math.floor(Math.random() * 90)),
      },
    });
  }
  console.log('  Created 10 triage audit logs');

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n══════════════════════════════════════════════════');
  console.log('  DEMO SEED SUMMARY');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Test Personas:      ${personas.length}`);
  console.log(`  Customers:          ${customerDefs.length} (8 FR, 7 EN)`);
  console.log(`  Yards:              ${yardDefs.length} (real Swiss addresses)`);
  console.log(`  Horses:             ${horses.length}`);
  console.log(`  Enquiries:          ${enquiryIds.length} (with message threads)`);
  console.log(`  Visit Requests:     ${visitIds.length}`);
  console.log(`  Triage Tasks:       ${triageTaskDefs.length}`);
  console.log(`  Route Runs:         ${routeRunDefs.length} (spanning 12 months)`);
  console.log(`  Appointments:       18 (8 completed, 4 confirmed, 3 proposed, 1 no-show, 2 cancelled)`);
  console.log(`  Visit Outcomes:     8 (with invoices)`);
  console.log(`  Dental Charts:      ${chartCount}`);
  console.log(`  Clinical Findings:  ${findingCount}`);
  console.log(`  Prescriptions:      ${prescriptionCount}`);
  console.log(`  Audit Logs:         10`);
  console.log('');
  console.log('  PERSONA CREDENTIALS (for demo sign-in):');
  console.log('  ┌──────────────────────┬──────────────────────────┬──────────┐');
  console.log('  │ Name                 │ Email                    │ Role     │');
  console.log('  ├──────────────────────┼──────────────────────────┼──────────┤');
  for (const p of personas) {
    const name = p.name.padEnd(20);
    const email = p.email.padEnd(24);
    const role = p.role.padEnd(8);
    console.log(`  │ ${name} │ ${email} │ ${role} │`);
  }
  console.log('  └──────────────────────┴──────────────────────────┴──────────┘');
  console.log('');
  console.log('  HOW TO RESET: npx prisma migrate reset && npm run db:seed-demo');
  console.log('');
  console.log('Demo seeding complete.\n');
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
