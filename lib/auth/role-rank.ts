/**
 * Pure, dependency-free role hierarchy.
 *
 * Lives in its own module so client code (e.g. UI components doing
 * presentation-only role gating) can import it without pulling in
 * `auth.ts` and the Auth.js bundle. The server-side
 * `lib/auth/rbac.ts` re-exports `ROLES`, `RANK` and `hasRole` from
 * here so the two surfaces can never drift.
 *
 * Bugbot #b323faef on PR #57 flagged that an earlier inline
 * `ROLE_RANK` map in `components/ui/DeleteEntityButton.tsx`
 * duplicated this hierarchy. The fix is the shared module — not the
 * extra wiring.
 */

export const ROLES = {
  ADMIN: 'admin',
  VET: 'vet',
  NURSE: 'nurse',
  READONLY: 'readonly',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const KNOWN_ROLES = new Set<Role>(Object.values(ROLES));

/**
 * Numeric rank, higher = more privilege. Unknown roles default to 0
 * (below READONLY) so they cannot satisfy any `requireRole` check.
 */
export const RANK: Record<Role, number> = {
  readonly: 1,
  nurse: 2,
  vet: 3,
  admin: 4,
};

export function normaliseRole(raw: string | null | undefined): Role {
  if (!raw) return ROLES.READONLY;
  const candidate = raw.trim().toLowerCase();
  return KNOWN_ROLES.has(candidate as Role) ? (candidate as Role) : ROLES.READONLY;
}

/**
 * True iff `actual` has at least the privilege of `required`.
 * Unknown / missing roles fail closed.
 */
export function hasRole(actual: string | null | undefined, required: Role): boolean {
  const actualRank = RANK[normaliseRole(actual)] ?? 0;
  return actualRank >= RANK[required];
}
