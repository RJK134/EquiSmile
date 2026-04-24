/**
 * Shared actor-context shape used by every domain service that writes
 * to an audit trail (AppointmentStatusHistory, SecurityAuditLog, ...).
 *
 * API route handlers thread `subject.actorLabel` from
 * `lib/auth/rbac.ts#requireRole` into this shape. n8n-triggered
 * mirrors pass `{ actor: 'n8n' }`. Services fall back to `'system'`
 * when no actor is supplied so the `changedBy` column is never blank.
 */
export interface ActorContext {
  actor?: string;
}
