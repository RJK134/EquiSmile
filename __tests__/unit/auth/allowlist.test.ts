import { describe, it, expect } from 'vitest';
import { isAllowed, parseAllowlist } from '@/lib/auth/allowlist';

describe('parseAllowlist', () => {
  it('returns an empty array for undefined or empty input', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist('')).toEqual([]);
    expect(parseAllowlist('   ')).toEqual([]);
  });

  it('splits comma-separated values and lowercases them', () => {
    expect(parseAllowlist('Alice, Bob ,CHARLIE')).toEqual(['alice', 'bob', 'charlie']);
  });

  it('drops empty entries', () => {
    expect(parseAllowlist('alice,,,bob,')).toEqual(['alice', 'bob']);
  });
});

describe('isAllowed', () => {
  const list = ['rjk134', 'vet@example.com'];

  it('allows a matching GitHub login (case-insensitive)', () => {
    expect(isAllowed(list, { githubLogin: 'RJK134' })).toBe(true);
  });

  it('allows a matching email (case-insensitive)', () => {
    expect(isAllowed(list, { email: 'VET@example.com' })).toBe(true);
  });

  it('denies a non-matching subject', () => {
    expect(isAllowed(list, { githubLogin: 'stranger', email: 'stranger@example.com' })).toBe(false);
  });

  it('denies everyone when the allowlist is empty', () => {
    expect(isAllowed([], { githubLogin: 'rjk134', email: 'vet@example.com' })).toBe(false);
  });

  it('handles null/undefined subject fields', () => {
    expect(isAllowed(list, { githubLogin: null, email: null })).toBe(false);
    expect(isAllowed(list, {})).toBe(false);
  });
});
