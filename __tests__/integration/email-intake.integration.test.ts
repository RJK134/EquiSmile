import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateInboundEmail, simulateSmtpSend } from '@/lib/demo/email-simulator';

vi.mock('@/lib/env', () => ({
  env: {
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    SMTP_PORT: '587',
    SMTP_FROM: '',
    DEMO_MODE: 'true',
  },
}));

describe('Email Intake — Integration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates realistic EN equine dental enquiry emails', () => {
    const email = generateInboundEmail('en');

    // Should look like a real customer email
    expect(email.from).toContain('<');
    expect(email.from).toContain('@example.com');
    expect(email.to).toBe('inbox@equismile.com');
    expect(email.subject.length).toBeGreaterThan(5);
    expect(email.text).toContain('horse');
    expect(email.messageId).toBeTruthy();
    expect(email.date).toBeTruthy();
  });

  it('generates realistic FR equine dental enquiry emails', () => {
    const email = generateInboundEmail('fr');

    expect(email.from).toContain('@example.ch');
    expect(email.text.length).toBeGreaterThan(20);
    // FR emails reference Swiss locations or equine topics
    const text = email.text.toLowerCase();
    expect(
      text.includes('cheval') ||
      text.includes('dentaire') ||
      text.includes('contrôle') ||
      text.includes('chevaux')
    ).toBe(true);
  });

  it('generates HTML version of emails', () => {
    const email = generateInboundEmail('en');
    expect(email.html).toContain('<div');
    expect(email.html).toContain('<br>');
  });

  it('simulates full email round-trip', async () => {
    // Simulate inbound
    const inbound = generateInboundEmail('en');
    expect(inbound.subject.length).toBeGreaterThan(0);

    // Simulate outbound reply
    const outbound = await simulateSmtpSend(
      'sarah.mitchell@example.com',
      'Re: ' + inbound.subject,
      'Thank you for your enquiry. We will get back to you shortly.',
    );

    expect(outbound.success).toBe(true);
    expect(outbound.accepted).toContain('sarah.mitchell@example.com');
  });

  it('generates unique message IDs', () => {
    const e1 = generateInboundEmail('en');
    const e2 = generateInboundEmail('en');
    expect(e1.messageId).not.toBe(e2.messageId);
  });
});
