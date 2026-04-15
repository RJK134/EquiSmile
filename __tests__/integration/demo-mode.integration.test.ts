import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  isDemoMode,
  setDemoMode,
  demoLog,
  requireDemoMode,
} from '@/lib/demo/demo-mode';
import {
  generateInboundPayload,
  simulateSendMessage,
  generateDeliveryReceipt,
  DEMO_CONTACTS,
} from '@/lib/demo/whatsapp-simulator';
import {
  generateInboundEmail,
  simulateSmtpSend,
} from '@/lib/demo/email-simulator';
import {
  simulateGeocode,
  simulateRouteOptimization,
  DEMO_LOCATIONS,
  HOME_BASE,
} from '@/lib/demo/maps-simulator';

describe('Demo Mode — Core', () => {
  afterEach(() => {
    setDemoMode(undefined);
  });

  it('reads DEMO_MODE from environment', () => {
    process.env.DEMO_MODE = 'true';
    setDemoMode(undefined);
    expect(isDemoMode()).toBe(true);
    process.env.DEMO_MODE = 'false';
    setDemoMode(undefined);
    expect(isDemoMode()).toBe(false);
  });

  it('can be overridden with setDemoMode', () => {
    setDemoMode(true);
    expect(isDemoMode()).toBe(true);
    setDemoMode(false);
    expect(isDemoMode()).toBe(false);
  });

  it('demoLog writes to console', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    demoLog('test message', { key: 'value' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[DEMO] test message'));
    spy.mockRestore();
  });

  it('requireDemoMode returns 403 reason when disabled', () => {
    setDemoMode(false);
    const result = requireDemoMode();
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain('Demo mode is not enabled');
    }
  });

  it('requireDemoMode allows when enabled', () => {
    setDemoMode(true);
    const result = requireDemoMode();
    expect(result.allowed).toBe(true);
  });
});

describe('Demo Mode — WhatsApp Simulator', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has demo contacts for EN and FR', () => {
    expect(DEMO_CONTACTS.en.phone).toBe('+41799001234');
    expect(DEMO_CONTACTS.fr.phone).toBe('+33612345678');
  });

  it('generates a valid inbound WhatsApp payload (EN)', () => {
    const payload = generateInboundPayload('en');
    expect(payload.object).toBe('whatsapp_business_account');
    expect(payload.entry).toHaveLength(1);
    expect(payload.entry[0].changes).toHaveLength(1);

    const msg = payload.entry[0].changes[0].value.messages[0];
    expect(msg.from).toBe('41799001234');
    expect(msg.type).toBe('text');
    expect(msg.text.body.length).toBeGreaterThan(0);
    expect(msg.id).toMatch(/^wamid\.demo_/);
  });

  it('generates a valid inbound WhatsApp payload (FR)', () => {
    const payload = generateInboundPayload('fr');
    const contact = payload.entry[0].changes[0].value.contacts[0];
    expect(contact.profile.name).toBe('Marie Dupont');
  });

  it('uses custom message when provided', () => {
    const payload = generateInboundPayload('en', 'Custom test message');
    const msg = payload.entry[0].changes[0].value.messages[0];
    expect(msg.text.body).toBe('Custom test message');
  });

  it('simulates outbound message delivery', async () => {
    const result = await simulateSendMessage('+41799001234', 'Hello');
    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^wamid\.demo_/);
    expect(result.deliveredAt).toBeDefined();
  });

  it('generates delivery receipts', () => {
    const receipt = generateDeliveryReceipt('wamid.test_123', 'delivered');
    expect(receipt.messageId).toBe('wamid.test_123');
    expect(receipt.status).toBe('delivered');
    expect(receipt.timestamp).toBeDefined();
  });
});

describe('Demo Mode — Email Simulator', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a valid EN inbound email', () => {
    const email = generateInboundEmail('en');
    expect(email.from).toContain('@example.com');
    expect(email.to).toBe('inbox@equismile.com');
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.text.length).toBeGreaterThan(0);
    expect(email.html).toContain('<div');
    expect(email.messageId).toMatch(/^<demo-/);
  });

  it('generates a valid FR inbound email', () => {
    const email = generateInboundEmail('fr');
    expect(email.from).toContain('@example.ch');
    expect(email.subject.length).toBeGreaterThan(0);
  });

  it('simulates SMTP send', async () => {
    const result = await simulateSmtpSend('test@example.com', 'Test Subject', 'Test body');
    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^<demo-/);
    expect(result.accepted).toContain('test@example.com');
    expect(result.rejected).toHaveLength(0);
  });
});

describe('Demo Mode — Maps Simulator', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has all required demo locations', () => {
    const requiredLocations = [
      'Villeneuve VD', 'Montreux', 'Aigle', 'Château-d\'Oex',
      'Bulle', 'Avenches', 'Lausanne', 'Nyon',
    ];
    for (const loc of requiredLocations) {
      expect(DEMO_LOCATIONS[loc]).toBeDefined();
      expect(DEMO_LOCATIONS[loc].lat).toBeGreaterThan(46);
      expect(DEMO_LOCATIONS[loc].lng).toBeGreaterThan(6);
    }
  });

  it('geocodes known locations', () => {
    const result = simulateGeocode('12 Route du Lac, Villeneuve VD');
    expect(result).not.toBeNull();
    expect(result!.latitude).toBe(46.3970);
    expect(result!.longitude).toBe(6.9277);
    expect(result!.partialMatch).toBe(false);
  });

  it('returns fallback for unknown addresses', () => {
    const result = simulateGeocode('123 Unknown Street, Nowhere');
    expect(result).not.toBeNull();
    expect(result!.partialMatch).toBe(true);
  });

  it('optimizes routes with nearest-neighbour', () => {
    const origin = { lat: HOME_BASE.lat, lng: HOME_BASE.lng, label: 'Home' };
    const waypoints = [
      { lat: DEMO_LOCATIONS['Montreux'].lat, lng: DEMO_LOCATIONS['Montreux'].lng, label: 'Montreux' },
      { lat: DEMO_LOCATIONS['Aigle'].lat, lng: DEMO_LOCATIONS['Aigle'].lng, label: 'Aigle' },
      { lat: DEMO_LOCATIONS['Bulle'].lat, lng: DEMO_LOCATIONS['Bulle'].lng, label: 'Bulle' },
    ];

    const result = simulateRouteOptimization(origin, waypoints);
    expect(result.orderedWaypoints).toHaveLength(3);
    expect(result.legs).toHaveLength(3);
    expect(result.totalDistanceMeters).toBeGreaterThan(0);
    expect(result.totalTravelMinutes).toBeGreaterThan(0);

    // Each leg should have from/to labels and positive metrics
    for (const leg of result.legs) {
      expect(leg.from.length).toBeGreaterThan(0);
      expect(leg.to.length).toBeGreaterThan(0);
      expect(leg.distanceMeters).toBeGreaterThan(0);
      expect(leg.durationMinutes).toBeGreaterThan(0);
    }
  });

  it('handles single waypoint route', () => {
    const origin = { lat: HOME_BASE.lat, lng: HOME_BASE.lng, label: 'Home' };
    const waypoints = [
      { lat: DEMO_LOCATIONS['Montreux'].lat, lng: DEMO_LOCATIONS['Montreux'].lng, label: 'Montreux' },
    ];

    const result = simulateRouteOptimization(origin, waypoints);
    expect(result.orderedWaypoints).toHaveLength(1);
    expect(result.legs).toHaveLength(1);
  });
});
