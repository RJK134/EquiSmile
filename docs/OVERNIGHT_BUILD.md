# Overnight Build — UAT Readiness Sweep

Working doc tracking the gap-closing PRs that turn the post-Phase-16 main
branch into a UAT-ready deployment. Once every PR listed in §3 is merged
or explicitly ruled out, this file can be deleted.

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

Three items remain. Two are clear wins; the third is a design call.

| ID | Gap | Why it matters | Sized |
|---|---|---|---|
| G1 | `.env.example` doesn't document Prisma pool tuning (`?connection_limit=…&pool_timeout=…`) | Defaults (`num_physical_cpus * 2 + 1`, ~5 on a 2-vCPU VPS) are fine for single-app / single-replica deployments. The moment an operator runs multiple app containers, a long migration, or tunes `max_connections` below the Postgres 16 default, pool exhaustion shows up with no breadcrumb in `.env.example`. Hint should defer to `docs/OPERATIONS.md` §2 as the source of truth. | XS — doc-only |
| G2 | No CORS handling on `/api/*` | Browser-origin protection currently relies on COOP/CORP + same-origin assumption. A future second domain (admin subdomain, mobile-PWA host) or n8n direct call from outside the compose network would 400. | S — middleware change |
| G3 | No native `@sentry/nextjs` SDK | Existing error webhook covers the use case (PII-scrubbed structured errors POSTed to any JSON sink, including a Sentry relay). A native SDK adds source-map symbolication, transaction tracing, and release tagging at the cost of vendor lock-in and bundle weight. | M — but design call first |

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

### PR A — `chore/overnight-build-spec-and-pool-doc` (this PR)
- Adds this file (`docs/OVERNIGHT_BUILD.md`) so reviewers of the next
  two PRs can see the framing in one place.
- Adds Prisma pool-tuning recommendation to `.env.example` next to
  `DATABASE_URL` (closes G1).
- No code changes. No migration. Operator-facing doc only.

### PR B — CORS allow-list for `/api/*` (closes G2)
- Adds an `allowedOrigins` array driven by `APP_ALLOWED_ORIGINS` env
  var (comma-separated). Defaults to `[NEXT_PUBLIC_APP_URL]` so
  same-origin keeps working without explicit config.
- Implements `OPTIONS` preflight + `Access-Control-Allow-{Origin,
  Methods, Headers, Credentials}` on `/api/*` only — pages stay
  same-origin-only.
- Webhook routes (`/api/webhooks/*`) and `/api/auth/*` are excluded
  from the allow-list — they have their own signature / token auth and
  must not return CORS responses to arbitrary origins.
- New tests in `lib/security/cors.test.ts` covering: allowed origin,
  disallowed origin, preflight, exclusion paths.

### PR C — Native Sentry SDK (G3, decision required first)
**Open question for review before code lands:**

The existing `EQUISMILE_ERROR_WEBHOOK_URL` system already handles the
"errors get reported off-box" requirement. A native Sentry SDK adds:
- Source-map symbolication (current system reports raw stack traces).
- Transaction / performance tracing.
- Release tagging tied to git SHA.
- Browser-side errors (current system is server-side only via
  `instrumentation.ts`).

It costs:
- New vendor dependency + ~300 KB browser bundle.
- A second error sink to keep configured.
- A duplication if both are kept active simultaneously.

Three viable options:
1. **Add Sentry alongside the webhook** — pay the bundle cost, get
   browser errors + symbolication, keep webhook for redundancy.
2. **Replace the webhook with Sentry** — single source of truth,
   accept the vendor lock-in, migrate `instrumentation.ts` to use
   `Sentry.captureException`.
3. **Don't add Sentry** — point `EQUISMILE_ERROR_WEBHOOK_URL` at a
   Sentry relay if symbolication is wanted later, defer browser-side
   error capture to a future phase.

PR C will not be opened until the operator picks one.

## 4. Out of scope

Things that were considered and explicitly deferred:

- Native iOS / Android wrappers — phase 2+ per `CLAUDE.md`.
- SSO providers beyond GitHub — current allow-list is small enough
  that magic-link is sufficient.
- Metric collection (Prometheus / OpenTelemetry traces) — error
  reporting is the priority for UAT; perf can come later.
- Customer-facing self-service portal — internal app first per
  `CLAUDE.md`.
