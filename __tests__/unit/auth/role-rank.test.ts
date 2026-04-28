import { describe, it, expect } from 'vitest';

import { ROLES, RANK, KNOWN_ROLES, hasRole, normaliseRole } from '@/lib/auth/role-rank';

/**
 * Bugbot #b323faef on PR #57 — the role hierarchy must live in a
 * single, dependency-free module so client and server share it.
 * `lib/auth/rbac.ts` re-exports from here. These tests guard the
 * shared surface so a regression there can't silently desync the
 * UI gate from the API enforcement.
 */

describe('lib/auth/role-rank — shared role hierarchy', () => {
  it('exposes the canonical four-role set', () => {
    expect(ROLES).toEqual({
      ADMIN: 'admin',
      VET: 'vet',
      NURSE: 'nurse',
      READONLY: 'readonly',
    });
    expect(KNOWN_ROLES.size).toBe(4);
  });

  it('rank order is admin > vet > nurse > readonly (strict)', () => {
    expect(RANK.admin).toBeGreaterThan(RANK.vet);
    expect(RANK.vet).toBeGreaterThan(RANK.nurse);
    expect(RANK.nurse).toBeGreaterThan(RANK.readonly);
  });

  it('hasRole — admin satisfies every required role', () => {
    expect(hasRole('admin', 'admin')).toBe(true);
    expect(hasRole('admin', 'vet')).toBe(true);
    expect(hasRole('admin', 'nurse')).toBe(true);
    expect(hasRole('admin', 'readonly')).toBe(true);
  });

  it('hasRole — vet satisfies vet/nurse/readonly but not admin', () => {
    expect(hasRole('vet', 'admin')).toBe(false);
    expect(hasRole('vet', 'vet')).toBe(true);
    expect(hasRole('vet', 'nurse')).toBe(true);
    expect(hasRole('vet', 'readonly')).toBe(true);
  });

  it('hasRole — readonly only satisfies readonly', () => {
    expect(hasRole('readonly', 'admin')).toBe(false);
    expect(hasRole('readonly', 'vet')).toBe(false);
    expect(hasRole('readonly', 'nurse')).toBe(false);
    expect(hasRole('readonly', 'readonly')).toBe(true);
  });

  it('hasRole fails closed for null / undefined / unknown roles', () => {
    expect(hasRole(null, 'readonly')).toBe(true); // readonly is the floor
    expect(hasRole(undefined, 'readonly')).toBe(true);
    expect(hasRole('', 'readonly')).toBe(true);
    expect(hasRole('superadmin', 'admin')).toBe(false);
    expect(hasRole('   ', 'admin')).toBe(false);
  });

  it('normaliseRole tolerates whitespace and case', () => {
    expect(normaliseRole('  ADMIN  ')).toBe('admin');
    expect(normaliseRole('Vet')).toBe('vet');
    expect(normaliseRole('unknown')).toBe('readonly');
    expect(normaliseRole(null)).toBe('readonly');
  });
});
