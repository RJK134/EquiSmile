# Overnight Build — UAT Readiness Sweep

Working doc tracking the gap-closing PRs that turned the post-Phase-16
main branch into a UAT-ready deployment. Sweep is now complete: all
three identified gaps are either closed (G1, G2) or explicitly deferred
with a documented future trigger (G3). Keep this file as the audit
trail; do not delete until either G3 fires (and a Sentry PR lands) or
the team decides to retire the framing.

## 1. What was already shipped before this sweep

Phase 16 closed the bulk of the readiness checklist. Re-stating it here
so reviewers don't ask "but what about X?" — X is almost certainly
already done.

| Area | File / module | Status |
|---|---|---|
| Auth — Auth.js with GitHub OAuth + email magic-link, allow-list | `app/api/auth/[...nextauth]/route.ts`, `lib/auth/*` | Done |
| RBAC — `READONLY` / `NURSE` / `ADMIN` roles | `lib/auth/rbac.ts`, applied across `/api/*` route handlers | Done |
| Soft-delete with cascade-restore (customer → yard → horse) | `lib/repositories/customer.repository.ts`, Prisma extension in `lib/prisma.ts` | Done |
| Audit logging with PII scrubbing | `lib/audit/*` | Done |
| Pagination on list endpoints (`page`, `pageSize`, `data`/`total`/`totalPages`) | `lib/validations/{customer,enquiry,horse,yard,appointment}.schema.ts` | Done |
| Security headers — CSP, COOP, CORP, HSTS, frame-ancestors | `lib/security/headers.ts` | Done |
| Rate limiting on auth + webhook endpoints | `lib/security/rate-limit.ts` | Done |
| Health / live / ready probes, `/api/status` reading backup freshness | `app/api/health`, `app/api/status` | Done |
| Privacy + terms pages with bilingual `next-intl` content | `app/[locale]/{privacy,terms}/page.tsx` | Done |
| Demo-mode runtime gating (server-side `DEMO_MODE`, no `NEXT_PUBLIC_*`) | `lib/demo/*`, `components/maps/RouteMap.tsx:225` (comment) | Done |
| Backup sidecar — `pg_dump` cron, retention, dedicated volume | `docker-compose.yml:202-232`, `docker/backup-entrypoint.sh`, `docs/BACKUP.md` | Done |
| Log rotation on every compose service (10 MB × 5) | `docker-compose.yml` `logging:` blocks | Done |
| `validate-env` script — refuses to start with weak / missing secrets | `scripts/validate-env.{sh,ts}` | Done |
| Error tracking via JSON-POST webhook (Sentry-relay-compatible) with PII scrub + 60s dedupe | `instrumentation.ts`, `lib/observability/error-webhook.ts`, `EQUISMILE_ERROR_WEBHOOK_URL` env var | Done |
| Attachment storage volume (`attachments_data`) | `docker-compose.yml:108`, `ATTACHMENT_STORAGE_DIR` | Done |
| UAT seed (`prisma/seed-demo.ts`) — bilingual customers, yards, horses across Vaud canton | `prisma/seed-demo.ts` | Done |

## 2. Confirmed gaps after audit

All three resolved. Status snapshot:

| ID | Gap | Resolution |
|---|---|---|
| G1 | `.env.example` doesn't document Prisma pool tuning (`?connection_limit=…&pool_timeout=…`) | **Closed** in PR #60 — `.env.example` block points to `docs/OPERATIONS.md` §2 as source of truth. |
| G2 | No CORS handling on `/api/*` | **Closed** in PR #61 — allow-list driven by `APP_ALLOWED_ORIGINS`, preflight handled in middleware before auth, server-to-server endpoints exempt. |
| G3 | No native `@sentry/nextjs` SDK | **Skipped (option c).** Existing webhook system covers the off-box error reporting need; vendor coupling deferred until a real production incident demonstrates the need for source-map symbolication or browser-side capture. Tracked as a future "option (a) — add Sentry alongside the webhook" if that need materialises (see §3 below). |

Items previously listed as "missing" that the audit cleared:
- Pagination — already on every list endpoint (uses `data`/`total` shape, not `items`).
- Privacy/terms — pages exist with full bilingual `next-intl` content, not stubs.
- Demo mode — already migrated to server-side `DEMO_MODE`; only one `NEXT_PUBLIC_DEMO_MODE` reference remains and it's a deprecation comment.
- Backup sidecar — `docker-compose.yml:207` already runs `postgres:16-alpine` with `BACKUP_CRON` + `BACKUP_RETENTION_DAYS`.
- Seed data — `prisma/seed-demo.ts` already populates the cohort UAT TC-001..008 expect; the test cases create their own inline data on top.

## 3. PR plan

Sequential, draft, smallest first. Each PR is independently revertible
and ships with `npm run lint && npm run typecheck && npm run test`
green before request-for-review.

### PR A ✅ merged (#60)
- Added this file (`docs/OVERNIGHT_BUILD.md`).
- Added Prisma pool-tuning recommendation to `.env.example` next to
  `DATABASE_URL` (closes G1).

### PR B ✅ merged (#61, closes G2)
- Allow-list driven by `APP_ALLOWED_ORIGINS` (comma-separated).
  Defaults to `[NEXT_PUBLIC_APP_URL]` so same-origin keeps working.
- `OPTIONS` preflight handled in middleware before the auth gate.
- Webhook routes (`/api/webhooks/*`), Auth.js (`/api/auth/*`) and
  n8n callbacks (`/api/n8n/*`, `/api/reminders/check`) exempt — they
  have their own server-to-server auth.
- 47 unit tests in `__tests__/unit/security/cors.test.ts`.

### PR C — Native Sentry SDK (G3) — skipped, deferred

Decision: **option (c)** — keep the existing
`EQUISMILE_ERROR_WEBHOOK_URL` system as-is. The webhook ships
PII-scrubbed structured errors today and satisfies the
"errors-get-reported-off-box" requirement.

Native `@sentry/nextjs` would add:
- Source-map symbolication (current system reports raw stack traces).
- Transaction / performance tracing.
- Release tagging tied to git SHA.
- Browser-side errors (current system is server-side only via
  `instrumentation.ts`).

It would cost:
- New vendor dependency + ~300 KB browser bundle.
- A second error sink to keep configured.
- A duplication if both are kept active simultaneously.

**Future trigger for option (a) — "add Sentry alongside the webhook"**:
revisit this decision when any of the following becomes true on
production:
- A real incident requires source-map symbolication that the raw
  stack trace doesn't surface.
- A browser-side bug needs capturing that the server-side webhook
  can't see (only server-side errors flow through
  `instrumentation.ts`).
- Release-tag attribution (which deploy introduced an error) becomes
  load-bearing for triage.

Until then, point `EQUISMILE_ERROR_WEBHOOK_URL` at any JSON sink the
team prefers (Slack incoming webhook, a self-hosted log collector, or
a Sentry relay if symbolication is wanted on a per-env basis).

## 4. Out of scope

Things that were considered and explicitly deferred:

- Native iOS / Android wrappers — phase 2+ per `CLAUDE.md`.
- SSO providers beyond GitHub — current allow-list is small enough
  that magic-link is sufficient.
- Metric collection (Prometheus / OpenTelemetry traces) — error
  reporting is the priority for UAT; perf can come later.
- Customer-facing self-service portal — internal app first per
  `CLAUDE.md`.
- Native `@sentry/nextjs` SDK — see §3 PR C; tracked as future
  option (a) once a real incident demonstrates the need.
