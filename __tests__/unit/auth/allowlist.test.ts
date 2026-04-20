import { describe, it, expect } from 'vitest';
import { isAllowed, parseAllowlist, __internals } from '@/lib/auth/allowlist';

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

describe('constantTimeEquals', () => {
  it('returns true for equal strings', () => {
    expect(__internals.constantTimeEquals('rjk134', 'rjk134')).toBe(true);
  });

  it('returns false for different-length strings without throwing', () => {
    expect(__internals.constantTimeEquals('rjk134', 'rjk1345')).toBe(false);
  });

  it('returns false for same-length different strings', () => {
    expect(__internals.constantTimeEquals('rjk134', 'rjk135')).toBe(false);
  });

  it('handles unicode safely', () => {
    expect(__internals.constantTimeEquals('café', 'café')).toBe(true);
    expect(__internals.constantTimeEquals('café', 'cafe')).toBe(false);
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

  it('matches the final entry in a longer list (no short-circuit regression)', () => {
    const big = ['aaa', 'bbb', 'ccc', 'rjk134'];
    expect(isAllowed(big, { githubLogin: 'rjk134' })).toBe(true);
  });
});
