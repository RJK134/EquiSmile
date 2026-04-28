import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { errorResponse } from '@/lib/api-utils';
import {
  ROLES,
  KNOWN_ROLES,
  RANK,
  normaliseRole,
  hasRole,
  type Role,
} from '@/lib/auth/role-rank';

/**
 * Phase 14 PR B — role-based access control.
 *
 * Roles are stored on `User.role` as a free-text string (Prisma schema).
 * The allowed vocabulary is defined here so the TS types and the DB
 * default stay in sync. Unknown role values are treated as
 * `ROLE.READONLY` — deny-by-default for anything sensitive.
 *
 * Design goals:
 *  - Single source of truth: every sensitive route calls `requireRole`
 *    from this file. No ad-hoc string comparisons elsewhere.
 *  - Deny by default: if the user's `role` is null, unknown, or blank,
 *    they can still log in (the session is valid) but every sensitive
 *    route returns 403 until an admin promotes them.
 *  - Explicit role hierarchy: ADMIN > VET > NURSE > READONLY.
 *  - Fail closed: any error in the auth/lookup path returns 403, not
 *    200.
 *
 * The pure rank logic (`ROLES`, `RANK`, `hasRole`, `normaliseRole`)
 * lives in `lib/auth/role-rank.ts` so client components can import
 * it without dragging in Auth.js. Re-exported here for
 * backwards-compatible callers.
 */

export { ROLES, normaliseRole, hasRole };
export type { Role };

export interface AuthenticatedSubject {
  id: string;
  email: string | null;
  githubLogin: string | null;
  role: Role;
  /** Best-available identifier for logging (never a token/secret). */
  actorLabel: string;
}

export class AuthzError extends Error {
  public readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Read the current session and normalise into the RBAC shape. Throws
 * {@link AuthzError} with 401 if there is no session.
 *
 * NB: the middleware gates most routes at the HTTP layer. This helper
 * re-checks at the handler layer because (a) the middleware can be
 * bypassed during future refactors, and (b) it gives us the typed
 * subject for downstream logic.
 */
export async function requireAuth(): Promise<AuthenticatedSubject> {
  const session = await auth();
  if (!session?.user) {
    throw new AuthzError('Authentication required', 401);
  }
  const role = normaliseRole(session.user.role);
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    githubLogin: session.user.githubLogin ?? null,
    role,
    actorLabel: session.user.githubLogin || session.user.email || session.user.id,
  };
}

/**
 * Require an authenticated subject with at least `required` privilege.
 * Throws {@link AuthzError} with 403 on insufficient role, 401 on no
 * session.
 */
export async function requireRole(required: Role): Promise<AuthenticatedSubject> {
  const subject = await requireAuth();
  if (!hasRole(subject.role, required)) {
    throw new AuthzError(`Insufficient role: ${required} required`, 403);
  }
  return subject;
}

/**
 * Map an {@link AuthzError} (or anything else) to a NextResponse. Call
 * this from the top of every protected route-handler `try { ... } catch`
 * block, OR use {@link withAuthz}/{@link withRole} wrappers.
 */
export function authzErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthzError) {
    return errorResponse(error.message, error.status);
  }
  throw error;
}

/**
 * Convenience wrapper: runs `handler(subject, ...args)` if authz passes,
 * otherwise returns the appropriate 401/403. Also catches application
 * errors raised inside the handler and forwards to the API error
 * utility — callers get a single consistent response shape.
 */
export function withRole<Args extends unknown[], R>(
  required: Role,
  handler: (subject: AuthenticatedSubject, ...args: Args) => Promise<R>,
): (...args: Args) => Promise<R | NextResponse> {
  return async (...args: Args) => {
    try {
      const subject = await requireRole(required);
      return await handler(subject, ...args);
    } catch (error) {
      if (error instanceof AuthzError) {
        return authzErrorResponse(error);
      }
      throw error;
    }
  };
}

export const __internals = { RANK, KNOWN_ROLES };
