import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  parseCAMT054,
  parseCSV,
  normaliseQrReference,
} from '@/lib/services/bank-import.service';

describe('normaliseQrReference', () => {
  it('strips whitespace and accepts a 27-digit reference', () => {
    expect(normaliseQrReference('21 00000 00003 13947 14300 09017')).toBe(
      '210000000003139471430009017',
    );
  });

  it('returns null for shorter or non-numeric strings', () => {
    expect(normaliseQrReference('123')).toBeNull();
    expect(normaliseQrReference('ABC0000000003139471430009017')).toBeNull();
    expect(normaliseQrReference(null)).toBeNull();
    expect(normaliseQrReference(undefined)).toBeNull();
    expect(normaliseQrReference('')).toBeNull();
  });
});

describe('parseCSV', () => {
  it('parses the canonical 6-column header + rows', () => {
    const csv = [
      'date,amount,currency,reference,description,counterparty',
      '2026-04-15,250.50,CHF,210000000003139471430009017,Invoice INV-2026-0001,Marie Dupont',
      '2026-04-16,120.00,CHF,,Random refund,Pierre Rochat',
    ].join('\n');
    const entries = parseCSV(csv);
    expect(entries).toHaveLength(2);
    expect(entries[0].amount.toString()).toBe('250.5');
    expect(entries[0].qrReference).toBe('210000000003139471430009017');
    expect(entries[0].counterparty).toBe('Marie Dupont');
    expect(entries[1].qrReference).toBeNull();
  });

  it('throws when required columns are missing', () => {
    const csv = ['random,header\n1,2'].join('\n');
    expect(() => parseCSV(csv)).toThrow(/date.*amount/i);
  });

  it('handles quoted fields with embedded commas', () => {
    const csv = [
      'date,amount,currency,reference,description,counterparty',
      '2026-04-15,250.50,CHF,,"Invoice, customer note","Test, Person"',
    ].join('\n');
    const entries = parseCSV(csv);
    expect(entries[0].description).toBe('Invoice, customer note');
    expect(entries[0].counterparty).toBe('Test, Person');
  });

  it('strips Swiss thousand separators (apostrophes) from amount', () => {
    const csv = [
      'date,amount,currency,reference,description,counterparty',
      "2026-04-15,1'250.00,CHF,,Test,Test",
    ].join('\n');
    const entries = parseCSV(csv);
    expect(entries[0].amount.toString()).toBe('1250');
  });
});

describe('parseCAMT054', () => {
  const SAMPLE_CAMT054 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.04">
  <BkToCstmrDbtCdtNtfctn>
    <Ntfctn>
      <Ntry>
        <Amt Ccy="CHF">250.50</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-04-15</Dt></BookgDt>
        <NtryDtls>
          <TxDtls>
            <RmtInf>
              <Strd><CdtrRefInf><Ref>210000000003139471430009017</Ref></CdtrRefInf></Strd>
            </RmtInf>
            <RltdPties><Dbtr><Nm>Marie Dupont</Nm></Dbtr></RltdPties>
          </TxDtls>
        </NtryDtls>
        <AddtlNtryInf>Invoice payment</AddtlNtryInf>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">120.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-04-16</Dt></BookgDt>
        <NtryDtls>
          <TxDtls>
            <RltdPties><Cdtr><Nm>Refund Co</Nm></Cdtr></RltdPties>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Ntfctn>
  </BkToCstmrDbtCdtNtfctn>
</Document>`;

  it('extracts entries with qrReference + signed amounts', () => {
    const entries = parseCAMT054(SAMPLE_CAMT054);
    expect(entries).toHaveLength(2);
    expect(entries[0].amount.toString()).toBe('250.5');
    expect(entries[0].qrReference).toBe('210000000003139471430009017');
    expect(entries[0].counterparty).toBe('Marie Dupont');
    expect(entries[0].currency).toBe('CHF');
    // Debit entry comes back with a negative amount.
    expect(entries[1].amount.toString()).toBe('-120');
    expect(entries[1].qrReference).toBeNull();
    expect(entries[1].counterparty).toBe('Refund Co');
  });

  it('returns an empty array when there are no Ntry elements', () => {
    const xml = `<?xml version="1.0"?><Document><BkToCstmrDbtCdtNtfctn><Ntfctn /></BkToCstmrDbtCdtNtfctn></Document>`;
    expect(parseCAMT054(xml)).toEqual([]);
  });
});

describe('parseCAMT054 amount precision', () => {
  it('preserves cent precision through Decimal', () => {
    const xml = `<?xml version="1.0"?>
<Document><BkToCstmrDbtCdtNtfctn><Ntfctn>
  <Ntry>
    <Amt Ccy="CHF">99.99</Amt>
    <CdtDbtInd>CRDT</CdtDbtInd>
    <BookgDt><Dt>2026-04-15</Dt></BookgDt>
  </Ntry>
</Ntfctn></BkToCstmrDbtCdtNtfctn></Document>`;
    const entries = parseCAMT054(xml);
    expect(entries[0].amount).toBeInstanceOf(Prisma.Decimal);
    expect(entries[0].amount.toString()).toBe('99.99');
  });
});
