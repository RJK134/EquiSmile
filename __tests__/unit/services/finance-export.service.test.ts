import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { buildWorkbook } from '@/lib/services/finance-export.service';

const D = (v: number | string) => new Prisma.Decimal(v);

const SAMPLE = {
  ym: '2026-04',
  invoices: [
    {
      invoiceNumber: 'INV-2026-0001',
      customerName: 'Marie Dupont',
      issuedAt: new Date('2026-04-02T00:00:00Z'),
      dueAt: new Date('2026-05-02T00:00:00Z'),
      total: D('250.50'),
      status: 'PAID',
      qrReference: '210000000003139471430009017',
      currency: 'CHF',
    },
    {
      invoiceNumber: 'INV-2026-0002',
      customerName: 'Pierre Rochat',
      issuedAt: new Date('2026-04-08T00:00:00Z'),
      dueAt: new Date('2026-05-08T00:00:00Z'),
      total: D('999.00'),
      status: 'OPEN',
      qrReference: null,
      currency: 'CHF',
    },
  ],
  payments: [
    {
      invoiceNumber: 'INV-2026-0001',
      customerName: 'Marie Dupont',
      paidAt: new Date('2026-04-15T00:00:00Z'),
      amount: D('250.50'),
      method: 'BANK_TRANSFER',
      reference: '210000000003139471430009017',
    },
  ],
  summary: {
    totalInvoiced: D('1249.50'),
    totalPaid: D('250.50'),
    totalOutstanding: D('999.00'),
    invoiceCount: 2,
    paymentCount: 1,
  },
};

describe('buildWorkbook', () => {
  it('produces three named sheets — Summary / Invoices / Payments', () => {
    const wb = buildWorkbook(SAMPLE);
    const names = wb.worksheets.map((s) => s.name);
    expect(names).toEqual(['Summary', 'Invoices', 'Payments']);
  });

  it('writes one row per invoice plus the header', () => {
    const wb = buildWorkbook(SAMPLE);
    const sheet = wb.getWorksheet('Invoices');
    expect(sheet?.rowCount).toBe(SAMPLE.invoices.length + 1);
    const cells = sheet?.getRow(2).values as unknown[];
    // ExcelJS prepends a null at index 0 for 1-indexing.
    expect(cells?.[1]).toBe('INV-2026-0001');
    expect(cells?.[2]).toBe('Marie Dupont');
  });

  it('writes the summary metrics with correct CHF formatting', () => {
    const wb = buildWorkbook(SAMPLE);
    const sheet = wb.getWorksheet('Summary')!;
    const rows = sheet.getRows(1, sheet.rowCount) ?? [];
    const map: Record<string, unknown> = {};
    for (const row of rows) {
      const k = row.getCell(1).value as string;
      map[k] = row.getCell(2).value;
    }
    expect(map['Total invoiced (CHF)']).toBe('1249.50');
    expect(map['Total paid (CHF)']).toBe('250.50');
    expect(map['Total outstanding (CHF)']).toBe('999.00');
    expect(map['Reporting period']).toBe('2026-04');
  });

  it('round-trips the workbook through xlsx.writeBuffer cleanly', async () => {
    const wb = buildWorkbook(SAMPLE);
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);

    // Read back and check we get the same sheet count.
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buf as ArrayBuffer);
    expect(wb2.worksheets.map((s) => s.name)).toEqual([
      'Summary',
      'Invoices',
      'Payments',
    ]);
  });

  it('handles a month with zero invoices + zero payments without throwing', () => {
    const wb = buildWorkbook({
      ym: '2026-05',
      invoices: [],
      payments: [],
      summary: {
        totalInvoiced: D(0),
        totalPaid: D(0),
        totalOutstanding: D(0),
        invoiceCount: 0,
        paymentCount: 0,
      },
    });
    expect(wb.getWorksheet('Invoices')?.rowCount).toBe(1); // header only
    expect(wb.getWorksheet('Payments')?.rowCount).toBe(1);
  });
});
