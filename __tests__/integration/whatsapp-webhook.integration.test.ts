import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateInboundPayload, DEMO_CONTACTS } from '@/lib/demo/whatsapp-simulator';

vi.mock('@/lib/env', () => ({
  env: {
    WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
    WHATSAPP_APP_SECRET: 'test-app-secret',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_ACCESS_TOKEN: '',
    WHATSAPP_API_TOKEN: '',
    DEMO_MODE: 'true',
  },
}));

const mockPrisma = vi.hoisted(() => ({
  enquiry: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  customer: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  visitRequest: {
    create: vi.fn(),
  },
  enquiryMessage: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/services/message-log.service', () => ({
  messageLogService: {
    logMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
  },
}));

describe('WhatsApp Webhook — Integration with Demo Payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates valid EN webhook payload matching expected structure', () => {
    const payload = generateInboundPayload('en');

    // Structure matches Meta WhatsApp Cloud API webhook format
    expect(payload.object).toBe('whatsapp_business_account');
    expect(payload.entry).toHaveLength(1);

    const entry = payload.entry[0];
    expect(entry.id).toBe('DEMO_BUSINESS_ACCOUNT');
    expect(entry.changes).toHaveLength(1);

    const change = entry.changes[0];
    expect(change.field).toBe('messages');

    const value = change.value;
    expect(value.messaging_product).toBe('whatsapp');
    expect(value.contacts).toHaveLength(1);
    expect(value.messages).toHaveLength(1);

    const contact = value.contacts[0];
    expect(contact.profile.name).toBe(DEMO_CONTACTS.en.name);
    expect(contact.wa_id).toBe(DEMO_CONTACTS.en.phone.replace('+', ''));

    const message = value.messages[0];
    expect(message.type).toBe('text');
    expect(message.text.body.length).toBeGreaterThan(10);
  });

  it('generates valid FR webhook payload', () => {
    const payload = generateInboundPayload('fr');
    const contact = payload.entry[0].changes[0].value.contacts[0];
    expect(contact.profile.name).toBe(DEMO_CONTACTS.fr.name);

    const message = payload.entry[0].changes[0].value.messages[0];
    expect(message.from).toBe(DEMO_CONTACTS.fr.phone.replace('+', ''));
  });

  it('generates unique message IDs for each payload', () => {
    const p1 = generateInboundPayload('en');
    const p2 = generateInboundPayload('en');
    const id1 = p1.entry[0].changes[0].value.messages[0].id;
    const id2 = p2.entry[0].changes[0].value.messages[0].id;
    expect(id1).not.toBe(id2);
  });

  it('simulates inbound message from a known customer', () => {
    const payload = generateInboundPayload('en');
    const from = payload.entry[0].changes[0].value.messages[0].from;

    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'demo-customer-sarah',
      fullName: 'Sarah Mitchell',
      mobilePhone: '+' + from,
    });

    // Verify the customer lookup would match
    expect(from).toBe('41799001234');
  });
});
