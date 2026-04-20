import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    horse: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
    yard: { findMany: vi.fn() },
  },
}));

import { vetupExportService, VETUP_PATIENT_COLUMNS } from '@/lib/services/vetup-export.service';
import { prisma } from '@/lib/prisma';

describe('vetupExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('horsesCsv includes header + denormalised owner/yard columns', async () => {
    (prisma.horse.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'h1',
        horseName: 'Storm',
        age: 12,
        notes: 'Headshy',
        dentalDueDate: new Date('2026-09-01T00:00:00Z'),
        active: true,
        customerId: 'c1',
        primaryYardId: 'y1',
        customer: {
          fullName: 'Rachel K',
          email: 'rk@example.com',
          mobilePhone: '+44111',
          preferredLanguage: 'en',
        },
        primaryYard: { id: 'y1', yardName: 'Hillside Stables', postcode: 'AB1 2CD' },
      },
    ]);

    const csv = await vetupExportService.horsesCsv();
    const lines = csv.split('\r\n');

    // Header contains the declared labels in order.
    const expectedHeader = VETUP_PATIENT_COLUMNS.map((c) => c.label).join(',');
    expect(lines[0]).toBe(expectedHeader);

    // Data row has the horse, owner, and yard values in the right places.
    expect(lines[1]).toContain('h1');
    expect(lines[1]).toContain('Storm');
    expect(lines[1]).toContain('Rachel K');
    expect(lines[1]).toContain('rk@example.com');
    expect(lines[1]).toContain('Hillside Stables');
    expect(lines[1]).toContain('AB1 2CD');
    expect(lines[1]).toContain('2026-09-01T00:00:00.000Z');
  });

  it('horsesCsv emits only a header when no horses are present', async () => {
    (prisma.horse.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const csv = await vetupExportService.horsesCsv();
    expect(csv).toBe(VETUP_PATIENT_COLUMNS.map((c) => c.label).join(','));
  });

  it('customersCsv escapes commas and quotes in free-text notes', async () => {
    (prisma.customer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'c1',
        fullName: 'Doe, Jane',
        email: 'j@example.com',
        mobilePhone: null,
        preferredChannel: 'WHATSAPP',
        preferredLanguage: 'en',
        notes: 'Says "careful"',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const csv = await vetupExportService.customersCsv();
    expect(csv).toContain('"Doe, Jane"');
    expect(csv).toContain('"Says ""careful"""');
  });

  it('yardsCsv includes geocoded lat/lng', async () => {
    (prisma.yard.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'y1',
        yardName: 'Hillside Stables',
        customerId: 'c1',
        addressLine1: '1 Hill Rd',
        addressLine2: null,
        town: 'Villeneuve',
        county: 'Vaud',
        postcode: '1844',
        latitude: 46.455,
        longitude: 6.856,
        accessNotes: null,
        customer: { fullName: 'Rachel K' },
      },
    ]);
    const csv = await vetupExportService.yardsCsv();
    expect(csv).toContain('46.455');
    expect(csv).toContain('6.856');
    expect(csv).toContain('Hillside Stables');
    expect(csv).toContain('Rachel K');
  });
});
