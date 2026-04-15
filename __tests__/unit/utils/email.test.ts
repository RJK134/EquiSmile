import { describe, it, expect } from 'vitest';
import { normaliseEmail, isValidEmail } from '@/lib/utils/email';

describe('normaliseEmail', () => {
  it('lowercases email addresses', () => {
    expect(normaliseEmail('User@Example.COM')).toBe('user@example.com');
  });

  it('trims whitespace', () => {
    expect(normaliseEmail('  user@example.com  ')).toBe('user@example.com');
  });

  it('handles already-normalised emails', () => {
    expect(normaliseEmail('user@example.com')).toBe('user@example.com');
  });
});

describe('isValidEmail', () => {
  it('validates correct emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('first.last@domain.co.uk')).toBe(true);
    expect(isValidEmail('test+tag@gmail.com')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });
});
