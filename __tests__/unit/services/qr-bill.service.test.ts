import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readPracticeCreditor,
  renderQRBillPdf,
} from '@/lib/services/qr-bill.service';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('EQUISMILE_PRACTICE_') || k === 'DEMO_MODE') {
      delete process.env[k];
    }
  }
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    if (k.startsWith('EQUISMILE_PRACTICE_') || k === 'DEMO_MODE') {
      process.env[k] = v;
    }
  }
}

describe('readPracticeCreditor', () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it('returns the placeholder creditor in DEMO_MODE when env unset', () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.EQUISMILE_PRACTICE_NAME;
    const c = readPracticeCreditor();
    expect(c.name).toMatch(/EquiSmile.*Demo/);
    expect(c.account).toMatch(/^CH/);
    expect(c.country).toBe('CH');
  });

  it('throws when env is incomplete and not DEMO_MODE', () => {
    delete process.env.DEMO_MODE;
    delete process.env.EQUISMILE_PRACTICE_NAME;
    expect(() => readPracticeCreditor()).toThrow(/EQUISMILE_PRACTICE/);
  });

  it('uses env values when all required keys are set', () => {
    process.env.EQUISMILE_PRACTICE_NAME = 'Real Practice GmbH';
    process.env.EQUISMILE_PRACTICE_ADDRESS = 'Hauptstrasse';
    process.env.EQUISMILE_PRACTICE_ZIP = '8000';
    process.env.EQUISMILE_PRACTICE_CITY = 'Zürich';
    process.env.EQUISMILE_PRACTICE_IBAN = 'CH4431999123000889012';
    delete process.env.DEMO_MODE;
    const c = readPracticeCreditor();
    expect(c.name).toBe('Real Practice GmbH');
    expect(c.account).toBe('CH4431999123000889012');
    expect(c.zip).toBe('8000');
  });
});

describe('renderQRBillPdf', () => {
  it('returns a non-empty PDF buffer with %PDF magic bytes', async () => {
    const buffer = await renderQRBillPdf({
      invoiceNumber: 'INV-2026-0001',
      amount: 250.5,
      currency: 'CHF',
      reference: '210000000003139471430009017',
      creditor: {
        name: 'Test Practice',
        address: 'Teststrasse',
        buildingNumber: '1',
        zip: '1000',
        city: 'Lausanne',
        country: 'CH',
        account: 'CH4431999123000889012',
      },
      // Customer with no address — the service should still produce a
      // valid PDF (debtor block omitted per QR-bill spec).
      debtor: { name: 'Marie Dupont' },
      message: 'Test invoice — name-only debtor',
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDFs always start with the literal "%PDF-".
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  }, 30_000);
});
