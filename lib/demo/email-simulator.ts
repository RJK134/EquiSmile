/**
 * Phase 9 — Email simulator for demo mode.
 *
 * Generates realistic inbound equine dental enquiry emails and
 * simulates SMTP send with logging.
 */

import { demoLog } from './demo-mode';

// ---------------------------------------------------------------------------
// Sample inbound emails
// ---------------------------------------------------------------------------

interface SimulatedInboundEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  date: string;
  messageId: string;
}

const SAMPLE_EMAILS_EN = [
  {
    from: 'sarah.mitchell@example.com',
    name: 'Sarah Mitchell',
    subject: 'Routine dental check — 2 horses at Montreux',
    text: 'Dear EquiSmile team,\n\nI would like to book routine dental checks for my 2 horses, Bramble and Shadow, at our yard in Montreux. We are flexible on dates but mornings work best.\n\nPlease let me know your availability.\n\nKind regards,\nSarah Mitchell\n+41 79 900 12 34',
  },
  {
    from: 'david.brown@example.com',
    name: 'David Brown',
    subject: 'Urgent — horse not eating, possible dental issue',
    text: 'Hi,\n\nMy horse Thunder has stopped eating and seems to be in pain when chewing. He\'s drooling more than usual. We are at the yard near Château-d\'Oex.\n\nCould someone come as soon as possible?\n\nThanks,\nDavid Brown\n+41 79 900 56 78',
  },
  {
    from: 'rachel.thompson@example.com',
    name: 'Rachel Thompson',
    subject: 'Annual dental appointments for riding school horses',
    text: 'Hello,\n\nWe have 4 horses at our riding school in Avenches that are due for their annual dental examinations. Could you arrange to visit sometime in May?\n\nBest wishes,\nRachel Thompson',
  },
];

const SAMPLE_EMAILS_FR = [
  {
    from: 'marie.dupont@example.ch',
    name: 'Marie Dupont',
    subject: 'Contrôle dentaire de routine — Villeneuve',
    text: 'Bonjour,\n\nJe souhaite prendre rendez-vous pour un contrôle dentaire de routine pour mes 2 chevaux à mon écurie de Villeneuve VD. Le matin de préférence.\n\nMerci de me confirmer vos disponibilités.\n\nCordialement,\nMarie Dupont\n+41 79 900 12 34',
  },
  {
    from: 'isabelle.moret@example.ch',
    name: 'Isabelle Moret',
    subject: 'Urgence dentaire — cheval qui ne mange plus',
    text: 'Bonjour,\n\nMon cheval Orage ne mange plus depuis hier et bave beaucoup. Il semble avoir très mal à la bouche. Nous sommes à Lausanne.\n\nPouvez-vous intervenir rapidement?\n\nMerci,\nIsabelle Moret\n+41 79 555 67 89',
  },
  {
    from: 'jeanluc.favre@example.ch',
    name: 'Jean-Luc Favre',
    subject: 'Examen dentaire annuel — 3 chevaux à Bulle',
    text: 'Bonjour,\n\nJe souhaite planifier les examens dentaires annuels pour mes 3 chevaux à l\'écurie de Bulle. N\'importe quel jour en mai ou juin convient.\n\nCordialement,\nJean-Luc Favre',
  },
];

// ---------------------------------------------------------------------------
// Inbound email generation
// ---------------------------------------------------------------------------

let emailCounter = 0;

function nextEmailMessageId(): string {
  emailCounter++;
  return `<demo-${Date.now()}-${emailCounter}@equismile-demo.local>`;
}

export function generateInboundEmail(language: 'en' | 'fr' = 'en'): SimulatedInboundEmail {
  const samples = language === 'fr' ? SAMPLE_EMAILS_FR : SAMPLE_EMAILS_EN;
  const sample = samples[Math.floor(Math.random() * samples.length)];
  const messageId = nextEmailMessageId();

  demoLog('Generating inbound email', {
    from: sample.from,
    subject: sample.subject,
    language,
  });

  return {
    from: `${sample.name} <${sample.from}>`,
    to: 'inbox@equismile.com',
    subject: sample.subject,
    text: sample.text,
    html: `<div style="font-family: Arial, sans-serif;">${sample.text.replace(/\n/g, '<br>')}</div>`,
    date: new Date().toISOString(),
    messageId,
  };
}

// ---------------------------------------------------------------------------
// Outbound SMTP simulation
// ---------------------------------------------------------------------------

export interface SimulatedSmtpResult {
  messageId: string;
  success: boolean;
  accepted: string[];
  rejected: string[];
}

export async function simulateSmtpSend(
  to: string,
  subject: string,
  text: string,
): Promise<SimulatedSmtpResult> {
  void text;
  const messageId = nextEmailMessageId();

  demoLog('Simulating SMTP send', { to, subject, messageId });

  // Realistic delay: 100-400ms
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 300));

  return {
    messageId,
    success: true,
    accepted: [to],
    rejected: [],
  };
}
