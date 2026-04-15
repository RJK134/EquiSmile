/**
 * Phase 9 — WhatsApp simulator for demo mode.
 *
 * Generates realistic WhatsApp webhook payloads, simulates outbound
 * delivery with delays, and produces mock delivery receipts.
 */

import { demoLog } from './demo-mode';

// ---------------------------------------------------------------------------
// Test contacts
// ---------------------------------------------------------------------------

export const DEMO_CONTACTS = {
  en: { phone: '+41799001234', name: 'Sarah Mitchell', language: 'en' },
  fr: { phone: '+33612345678', name: 'Marie Dupont', language: 'fr' },
} as const;

// ---------------------------------------------------------------------------
// Sample inbound messages
// ---------------------------------------------------------------------------

const SAMPLE_MESSAGES_EN = [
  'Hi, I need to book a routine dental check for my horse Bramble at the yard in Montreux. Mornings preferred, any day next week.',
  'Hello, my horse hasn\'t been eating properly for 2 days. He seems to have pain in his mouth. Can someone come urgently to Aigle?',
  'I\'d like to schedule annual dental checks for 3 horses at my yard in Villeneuve. We\'re flexible on timing.',
  'Can you come check my horse Thunder at Château-d\'Oex? He\'s due for his routine dental. Afternoons work best.',
];

const SAMPLE_MESSAGES_FR = [
  'Bonjour, je souhaite prendre rendez-vous pour un contrôle dentaire de routine pour mon cheval Éclat à Bulle. De préférence le matin.',
  'Mon cheval ne mange plus depuis 2 jours et bave beaucoup. C\'est urgent, pouvez-vous venir à Avenches?',
  'J\'aimerais planifier des contrôles dentaires pour 2 chevaux à Lausanne. N\'importe quel jour en mai convient.',
  'Pouvez-vous examiner mon cheval Mistral à Villeneuve? Il a du mal à mâcher. Ce n\'est pas urgent mais assez vite si possible.',
];

// ---------------------------------------------------------------------------
// Webhook payload generation
// ---------------------------------------------------------------------------

let messageCounter = 0;

function nextMessageId(): string {
  messageCounter++;
  return `wamid.demo_${Date.now()}_${messageCounter}`;
}

export interface SimulatedWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts: Array<{ profile: { name: string }; wa_id: string }>;
        messages: Array<{
          from: string;
          id: string;
          timestamp: string;
          text: { body: string };
          type: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export function generateInboundPayload(
  language: 'en' | 'fr' = 'en',
  customMessage?: string,
): SimulatedWebhookPayload {
  const contact = DEMO_CONTACTS[language];
  const messages = language === 'fr' ? SAMPLE_MESSAGES_FR : SAMPLE_MESSAGES_EN;
  const body = customMessage || messages[Math.floor(Math.random() * messages.length)];
  const messageId = nextMessageId();

  demoLog('Generating inbound WhatsApp payload', {
    from: contact.phone,
    language,
    messageId,
  });

  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'DEMO_BUSINESS_ACCOUNT',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+41780001234',
                phone_number_id: 'DEMO_PHONE_NUMBER_ID',
              },
              contacts: [
                {
                  profile: { name: contact.name },
                  wa_id: contact.phone.replace('+', ''),
                },
              ],
              messages: [
                {
                  from: contact.phone.replace('+', ''),
                  id: messageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Outbound simulation
// ---------------------------------------------------------------------------

export interface SimulatedSendResult {
  messageId: string;
  success: boolean;
  deliveredAt?: string;
}

export async function simulateSendMessage(
  to: string,
  _text: string,
): Promise<SimulatedSendResult> {
  const messageId = nextMessageId();

  demoLog('Simulating outbound WhatsApp message', { to, messageId });

  // Realistic delay: 200-800ms
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 600));

  return {
    messageId,
    success: true,
    deliveredAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Delivery receipt simulation
// ---------------------------------------------------------------------------

export interface SimulatedDeliveryReceipt {
  messageId: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
}

export function generateDeliveryReceipt(
  messageId: string,
  status: 'sent' | 'delivered' | 'read' = 'delivered',
): SimulatedDeliveryReceipt {
  demoLog('Generating delivery receipt', { messageId, status });
  return {
    messageId,
    status,
    timestamp: new Date().toISOString(),
  };
}
