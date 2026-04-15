import { describe, it, expect } from 'vitest';
import { normalisePhone, isValidE164 } from '@/lib/utils/phone';

describe('normalisePhone', () => {
  it('returns null for empty/null input', () => {
    expect(normalisePhone('')).toBeNull();
    expect(normalisePhone('  ')).toBeNull();
  });

  it('passes through valid E.164 numbers', () => {
    expect(normalisePhone('+447700900001')).toBe('+447700900001');
    expect(normalisePhone('+33612345678')).toBe('+33612345678');
  });

  it('strips spaces and dashes from E.164', () => {
    expect(normalisePhone('+44 7700 900001')).toBe('+447700900001');
    expect(normalisePhone('+44-7700-900001')).toBe('+447700900001');
  });

  it('converts UK mobile (07...) to E.164', () => {
    expect(normalisePhone('07700900001')).toBe('+447700900001');
    expect(normalisePhone('07700 900001')).toBe('+447700900001');
  });

  it('converts French mobile (06/07) to E.164', () => {
    expect(normalisePhone('0612345678')).toBe('+33612345678');
    expect(normalisePhone('0712345678')).toBe('+33712345678');
  });

  it('converts 0044 prefix to +44', () => {
    expect(normalisePhone('00447700900001')).toBe('+447700900001');
  });

  it('converts 0033 prefix to +33', () => {
    expect(normalisePhone('0033612345678')).toBe('+33612345678');
  });

  it('converts UK landline to E.164', () => {
    expect(normalisePhone('01234567890')).toBe('+441234567890');
    expect(normalisePhone('02012345678')).toBe('+442012345678');
  });

  it('returns null for unrecognised formats', () => {
    expect(normalisePhone('123')).toBeNull();
    expect(normalisePhone('not-a-number')).toBeNull();
  });
});

describe('isValidE164', () => {
  it('validates correct E.164 numbers', () => {
    expect(isValidE164('+447700900001')).toBe(true);
    expect(isValidE164('+33612345678')).toBe(true);
    expect(isValidE164('+12025551234')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidE164('07700900001')).toBe(false);
    expect(isValidE164('+0123')).toBe(false);
    expect(isValidE164('')).toBe(false);
    expect(isValidE164('abc')).toBe(false);
  });
});
