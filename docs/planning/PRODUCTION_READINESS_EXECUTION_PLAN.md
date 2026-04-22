# EquiSmile — Production Readiness Execution Plan

**Repository:** `RJK134/EquiSmile`  
**Date:** 2026-04-22  
**Purpose:** Convert the outstanding production-readiness audit into an actionable PR-ready execution plan.

---

## 1. Objective

Close the remaining blockers preventing EquiSmile from safe real-world deployment handling customer PII in a Swiss veterinary practice.

This phase explicitly prioritises:
- access control
- data safety
- operational resilience
- compliance-minded logging/audit
- deployment correctness

This phase does **not** prioritise broad new product features.

---

## 2. Source documents reviewed

- `CLAUDE.md`
- `README.md`
- `docs/BUILD_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- production-readiness review dated 2026-04-18
- associated release / known issue / deployment docs where present

---

## 3. Delivery strategy

Deliver in **small reviewable batches**, but keep all work inside one coherent production-readiness phase PR if possible.

### Recommended branch
- `feature/phase15-production-readiness-hardening`

### PR title
- `feat(phase15): close production blockers and harden live deployment baseline`

---

## 4. Batch plan

## Batch 1 — Authentication and route protection
### Scope
- Add/finish session auth for internal app access
- Gate business UI and business API routes
- Preserve public access only where intentionally required

### Tasks
- [ ] Implement auth/session strategy
- [ ] Add login page / redirect flow
- [ ] Protect business routes in middleware
- [ ] Protect business API endpoints
- [ ] Preserve `/api/health`, `/api/webhooks/*`, `/api/n8n/*` access as appropriate
- [ ] Add tests for unauthenticated redirect / API rejection
- [ ] Update setup and architecture docs

### Acceptance
- [ ] Unauthenticated UI access redirects to login
- [ ] Unauthenticated business API access returns 401/403
- [ ] Webhooks and internal service callbacks still function as designed

---

## Batch 2 — Soft deletes and safer data lifecycle
### Scope
- Replace hard deletes on key customer-facing entities
- Ensure recovery/audit path exists

### Tasks
- [ ] Add `deletedAt` to target Prisma models
- [ ] Create additive migration
- [ ] Replace repository delete operations with soft-delete updates
- [ ] Filter soft-deleted rows by default
- [ ] Add tests for soft-deleted data invisibility
- [ ] Document purge/erasure approach if needed

### Acceptance
- [ ] No hard deletes remain on customer/horse/yard-style business entities
- [ ] List/detail APIs exclude soft-deleted records by default
- [ ] Migration applies cleanly

---

## Batch 3 — Deployment/env/CSP baseline
### Scope
- Fix Docker env pass-through
- Add CSP and validate runtime compatibility

### Tasks
- [ ] Add missing env vars to Docker Compose
- [ ] Ensure build-time env for browser-exposed Maps key is correct
- [ ] Add CSP header to Caddyfile
- [ ] Validate Maps, PWA, and service worker behaviour
- [ ] Update deployment docs

### Acceptance
- [ ] Docker deployment has all required env vars
- [ ] Interactive Maps work in Docker
- [ ] CSP is active without breaking runtime flows

---

## Batch 4 — Operational safety and resilience
### Scope
- Add backup strategy
- Add error tracking
- Add rate limiting
- Redact PII in logs

### Tasks
- [ ] Add backup service/process and restore docs
- [ ] Integrate Sentry or equivalent
- [ ] Add API/application rate limiting
- [ ] Audit logs for PII leakage
- [ ] Replace direct PII console logging with safe identifiers/redaction
- [ ] Add Docker log rotation config if not already present
- [ ] Add tests for redaction and limiter behaviour where feasible

### Acceptance
- [ ] Backups are produced and restore procedure is documented
- [ ] Runtime errors are captured centrally
- [ ] Abuse-prone endpoints are rate-limited
- [ ] PII is no longer emitted in plaintext logs

---

## Batch 5 — Launch hygiene and follow-on operational polish
### Scope
- Pagination, audit trail completion, privacy/terms, token ops, connection tuning

### Tasks
- [ ] Add pagination on large list endpoints
- [ ] Review/complete audit trail coverage
- [ ] Add privacy and terms pages
- [ ] Document WhatsApp token lifecycle
- [ ] Tune DB connection settings
- [ ] Update known issues and production-readiness docs

### Acceptance
- [ ] Large lists are paginated
- [ ] Privacy/terms surfaces exist
- [ ] Operational docs cover token refresh/expiry handling
- [ ] Production-readiness docs are truthful and current

---

## 5. Validation checklist

After each meaningful batch:
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npx prisma validate`
- [ ] `npm run build`

If schema changes:
- [ ] migration created and reviewed
- [ ] migration applies cleanly
- [ ] seed/demo behaviour verified as needed

---

## 6. Review loop

For each batch:
- [ ] commit with meaningful message
- [ ] push to branch
- [ ] update PR checklist
- [ ] request Copilot review
- [ ] request BugBot review
- [ ] fix HIGH findings immediately
- [ ] fix MEDIUM if quick; otherwise log
- [ ] rerun validation

---

## 7. Definition of done

This phase is complete when:
- [ ] auth is enforced
- [ ] key deletions are soft-delete safe
- [ ] Docker/env/CSP baseline is corrected
- [ ] backup/error tracking/rate limiting/log redaction are in place
- [ ] docs updated
- [ ] tests updated
- [ ] PR ready for review with truthful verification notes.