import { describe, it, expect } from 'vitest';

import { redactAuditDetails, __internals } from '@/lib/utils/audit-redact';

describe('redactAuditDetails', () => {
  it('passes through safe operator payloads unchanged', () => {
    const input = { reason: 'soft-delete', source: 'admin-ui' };
    const out = redactAuditDetails(input);
    expect(out).toEqual({ reason: 'soft-delete', source: 'admin-ui' });
  });

  it('preserves null and undefined', () => {
    expect(redactAuditDetails(null)).toBeNull();
    expect(redactAuditDetails(undefined)).toBeUndefined();
  });

  it('scrubs values of PII-named keys regardless of content', () => {
    // Even an "innocuous" string in a PII-named key gets redacted —
    // we can't tell if 'JS' is initials or a placeholder.
    const out = redactAuditDetails({
      mobilePhone: 'JS',
      email: '',
      fullName: 'X',
      horseName: 'Smudge',
      yardName: 'Hill Farm',
      rawText: 'short',
      address: '1 The Road',
      notes: 'see file',
    });
    expect(out).toEqual({
      mobilePhone: '[pii-redacted]',
      email: '[pii-redacted]',
      fullName: '[pii-redacted]',
      horseName: '[pii-redacted]',
      yardName: '[pii-redacted]',
      rawText: '[pii-redacted]',
      address: '[pii-redacted]',
      notes: '[pii-redacted]',
    });
  });

  it('redacts phone-shaped values in non-PII keys', () => {
    const out = redactAuditDetails({ contact: '+447911123456', primary: '01234 567890' });
    expect(out).toEqual({ contact: '[phone]', primary: '[phone]' });
  });

  it('redacts email-shaped values in non-PII keys', () => {
    const out = redactAuditDetails({ source: 'sarah@example.com' });
    expect(out).toEqual({ source: '[email]' });
  });

  it('redacts long free-text in non-PII keys', () => {
    const longish =
      'Hello, my horse Smudge has been lame on her near-fore for three days now and her stable is at Hill Farm.';
    const out = redactAuditDetails({ snippet: longish });
    expect(out).toEqual({ snippet: '[free-text]' });
  });

  it('keeps short canonical strings (status codes, IDs, reasons)', () => {
    const out = redactAuditDetails({
      reason: 'spam',
      action: 'CUSTOMER_DELETED',
      status: 'OK',
      id: 'cust-123',
      uuid: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(out).toEqual({
      reason: 'spam',
      action: 'CUSTOMER_DELETED',
      status: 'OK',
      id: 'cust-123',
      uuid: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('recurses into nested objects (the {before, after} diff pattern)', () => {
    const out = redactAuditDetails({
      action: 'STATUS_CHANGED',
      before: { fullName: 'Sarah', status: 'ACTIVE', mobilePhone: '+447911123456' },
      after: { fullName: 'Sarah', status: 'TOMBSTONED' },
    });
    expect(out).toEqual({
      action: 'STATUS_CHANGED',
      before: { fullName: '[pii-redacted]', status: 'ACTIVE', mobilePhone: '[pii-redacted]' },
      after: { fullName: '[pii-redacted]', status: 'TOMBSTONED' },
    });
  });

  it('recurses into arrays', () => {
    const out = redactAuditDetails({
      events: [
        { reason: 'spam', email: 'a@b.com' },
        { reason: 'duplicate', mobilePhone: '+447911111111' },
      ],
    });
    expect(out).toEqual({
      events: [
        { reason: 'spam', email: '[pii-redacted]' },
        { reason: 'duplicate', mobilePhone: '[pii-redacted]' },
      ],
    });
  });

  it('does not mutate the caller\'s input', () => {
    const input = {
      action: 'X',
      payload: { fullName: 'Sarah', items: [{ email: 'a@b.com' }] },
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    redactAuditDetails(input);
    expect(input).toEqual(snapshot);
  });

  it('still applies the underlying log-redact secret/token rules', () => {
    const out = redactAuditDetails({
      Authorization: 'Bearer abcdef',
      cookie: 'session=...',
      api_key: 'sk-secret',
    });
    expect(out).toMatchObject({
      Authorization: '[redacted]',
      cookie: '[redacted]',
      api_key: '[redacted]',
    });
  });

  it('handles circular references without throwing', () => {
    const a: Record<string, unknown> = { reason: 'spam' };
    a.self = a;
    expect(() => redactAuditDetails(a)).not.toThrow();
    const out = redactAuditDetails(a) as Record<string, unknown>;
    expect(out.reason).toBe('spam');
    expect(out.self).toBe('[circular]');
  });

  it('keeps non-string scalars (numbers, booleans) intact', () => {
    const out = redactAuditDetails({ count: 42, active: true, ratio: 0.5 });
    expect(out).toEqual({ count: 42, active: true, ratio: 0.5 });
  });

  it('passes through arrays of scalars unchanged when none look PII', () => {
    const out = redactAuditDetails({ ids: ['cust-1', 'cust-2'] });
    expect(out).toEqual({ ids: ['cust-1', 'cust-2'] });
  });
});

describe('__internals', () => {
  it('looksLikePhone matches typical inbound shapes', () => {
    expect(__internals.looksLikePhone('+447911123456')).toBe(true);
    expect(__internals.looksLikePhone('07911 123 456')).toBe(true);
    expect(__internals.looksLikePhone('(0123) 456-7890')).toBe(true);
    expect(__internals.looksLikePhone('12345')).toBe(false); // too short
    expect(__internals.looksLikePhone('not a phone')).toBe(false);
  });

  it('looksLikeEmail rejects malformed addresses', () => {
    expect(__internals.looksLikeEmail('a@b.com')).toBe(true);
    expect(__internals.looksLikeEmail('first.last+tag@sub.example.co.uk')).toBe(true);
    expect(__internals.looksLikeEmail('not an email')).toBe(false);
    expect(__internals.looksLikeEmail('a@b')).toBe(false);
    expect(__internals.looksLikeEmail('@b.com')).toBe(false);
  });

  it('isPIIKey is case-insensitive and substring-matched', () => {
    expect(__internals.isPIIKey('mobilePhone')).toBe(true);
    expect(__internals.isPIIKey('MobilePhoneNumber')).toBe(true);
    expect(__internals.isPIIKey('email')).toBe(true);
    expect(__internals.isPIIKey('FullName')).toBe(true);
    expect(__internals.isPIIKey('id')).toBe(false);
    expect(__internals.isPIIKey('reason')).toBe(false);
    expect(__internals.isPIIKey('action')).toBe(false);
  });
});
