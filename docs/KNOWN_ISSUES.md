# EquiSmile Known Issues

## Phase 16 — Overnight hardening, eighth slice (2026-04-27)

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| OVH8-SOFTDEL-UI | Medium | The soft-delete infrastructure shipped across PRs #51, #52, the AuditLog parity work, and the Prisma extension was operationally invisible — operators had to `curl` the DELETE endpoints. No UI button, no confirmation flow, no toast. The feature was in practice unused, leaving the AuditLog table empty and the audit story untested in production. | Resolved — new `components/ui/DeleteEntityButton.tsx` reusable component (role-aware, modal-confirmed, toast-on-result, locale-aware redirect). Wired into the four detail pages: `app/[locale]/{customers,yards,horses,enquiries}/[id]/page.tsx`. Customer/yard/enquiry require admin; horse requires vet (mirrors the API). EN + FR i18n strings added under `softDelete.*`. 12 vitest cases regress role gating (admin vs readonly/nurse/vet/no-session), the no-one-click rule, fetch wiring, success-toast-and-redirect, error-toast-and-stay, and network-throw handling. |

## Phase 16 — Overnight hardening, seventh slice (2026-04-27)

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| OVH7-SETUP-EXECSYNC | Medium | PR #51 known risk #4 — `/api/setup` invoked `execSync('npx prisma migrate deploy')` and `execSync('npx tsx prisma/seed-demo.ts')` from an HTTP handler. Three problems: (1) child-process spawn from a request handler is a code-execution vector if the `DEMO_MODE` gate ever weakens; (2) `execSync` blocks the Node event loop for the full duration of the migration/seed, starving every other in-flight request; (3) error handling worked off raw stderr text, which can carry DB credentials in failure modes. | Resolved — handler rewritten to a stable 410 Gone response with operator guidance. The compose stack already runs migrations correctly via the `migrator` service; local-dev callers see `npx prisma migrate deploy && npx tsx prisma/seed-demo.ts` in the response body. `DEMO_MODE` gate retained as defence-in-depth. New `__tests__/unit/api/setup.test.ts` (5 cases) including a static-analysis regression that fails CI if `child_process`, `execSync`, `spawn`, or `fork` ever return to the route. |

## Phase 16 — Overnight hardening (2026-04-25)

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| OVH-AUTH-COMPLETE | High | No mechanical proof that every business `app/api/*` route is gated by a session — relied on per-route audits | Resolved — `__tests__/unit/auth/auth-guard-completeness.test.ts` walks every `route.ts` under `app/api/` and asserts that any non-whitelisted path returns 401 unauthenticated. |
| OVH-DEMO-LEAK-CLIENT | Medium | `RouteMap` read `process.env.NEXT_PUBLIC_DEMO_MODE`, baking demo-mode state into the live client bundle | Resolved — removed; client now uses absence-of-`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` + an explicit `forceStatic` prop driven by server-side runtime status. |
| OVH-ENQ-SOFTDEL | High | Phase 15 added soft-delete to Customer/Yard/Horse but Enquiry rows (inbound customer messages) were still hard-deletable | Resolved — `Enquiry.deletedAt` + `Enquiry.deletedById` migration `20260425000000_phase16_enquiry_softdelete_auditlog`; repository filters `deletedAt: null` by default. |
| OVH-NO-AUDIT-GENERIC | Medium | `SecurityAuditLog` covers security events; `TriageAuditLog` covers visit-request fields; nothing covered generic operator mutations (enquiry tombstone, route-run flips) | Resolved — generic `AuditLog` model + `lib/services/audit-log.service.ts` with redacted JSON `details`, append-only writes, best-effort failure handling. |
| OVH-CADDY-CSP | Medium | Caddy emitted basic security headers but no CSP — a request that bypassed the Next middleware (cached static, n8n subdomain, error page) had no CSP fallback | Resolved — Caddyfile now sets a CSP at the proxy layer mirroring `lib/security/headers.ts`, plus `Permissions-Policy`, COOP and CORP. |
| OVH-STATUS-SHALLOW | Medium | `/api/status` reported integration *modes* but did not actively probe DB / n8n / messaging readiness | Resolved — `/api/status` now runs a live `SELECT 1`, n8n `/healthz` probe (3s timeout), and per-integration readiness summaries with `missing[]` lists. |
| OVH-PII-RESIDUAL | Low | Two stray PII paths: full address in geocoding partial-match warning, raw error object in manual-enquiry auto-triage failure | Resolved — geocoding now logs postcode prefix only; auto-triage failure logs `error.message` against `enquiryId`. |

## Phase 16 — Overnight hardening, third slice (2026-04-26)

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| OVH3-AUDITLOG-PARITY | Medium | The generic `AuditLog` table introduced in PR #51 had only one caller (`DELETE /api/enquiries/[id]` from PR #52). The pre-existing Customer / Yard / Horse soft-delete handlers (Phase 15) wrote only `SecurityAuditLog`, leaving the `AuditLog` table half-built — an operator looking up "everything that has happened to customer X" via `AuditLog.entityId` would see only enquiries. | Resolved — Customer / Yard / Horse `DELETE` handlers now dual-write to BOTH `SecurityAuditLog` (security-event timeline) AND `AuditLog` (per-entity index). New tests in `__tests__/unit/api/yards.test.ts` and `__tests__/unit/api/horses.test.ts` plus an extended `customers.test.ts` regression. Documented as a hard rule in `docs/ARCHITECTURE.md` → "Audit trail" so future contributors don't drift. |

## Phase 16 — Overnight hardening, second slice (2026-04-25)

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| OVH2-COERCE-BOOL | High | `enquiryQuerySchema.includeDeleted` used `z.coerce.boolean()`. JS `Boolean()` returns true for any non-empty string — including `"false"`. `?includeDeleted=false` would have silently exposed tombstoned enquiries containing inbound customer messages. (Cursor Bugbot #c7a7eb5c.) | Resolved — replaced with `z.enum(['true','false']).transform(v => v === 'true')` matching the customer/yard/horse pattern, plus regression tests asserting `'false'` → `false` and rejection of `'1'`/`'yes'`/empty string. |
| OVH2-ENQ-INC-DEL-GATE | Medium | The new `includeDeleted` flag flowed unguarded through `GET /api/enquiries`. A `READONLY` user could URL-hack `?includeDeleted=true` and read tombstoned enquiry PII. (Cursor Bugbot #99773815.) | Resolved — handler now silently downgrades the flag to `false` for non-admin sessions, mirroring `app/api/customers/route.ts`. Three new vitest cases lock this in. |
| OVH2-N8N-PROBE-DEAD-BRANCH | Low | `probeN8n` returned `'unconfigured'` when `!env.N8N_HOST`, but `lib/env.ts` defaults `N8N_HOST` to `'localhost'` — making the branch dead code. Stacks with no n8n burned a 3-second timeout per `/api/status` poll and reported `'unreachable'`. (Cursor Bugbot #da88139d.) | Resolved — branch now keys on `!env.N8N_API_KEY`, the credential every n8n callback already fail-closes on. New regression test asserts no `fetch()` call when the key is absent. |
| OVH2-ENQ-DELETE-ROUTE | High | The Enquiry repository gained `delete()` / `restore()` / `hardDelete()` in PR #51 but no HTTP entry point existed — admins could delete customers/yards/horses but not misrouted spam enquiries. | Resolved — `DELETE /api/enquiries/[id]` (admin-gated, soft-delete, writes both `SecurityAuditLog{event:'ENQUIRY_DELETED'}` and the generic `AuditLog{action:'ENQUIRY_DELETED'}`). Migration `20260425100000_phase16_enquiry_audit_events` adds the new enum values. |
| OVH2-AUTOTRIAGE-LOG-PII | Low | Auto-triage failure log included `err.message`. Inner triage services occasionally embed raw inbound text in their error messages (e.g. `"failed to parse: '<customer message>'"`), bypassing the `maskPhone`/`maskEmail` utilities. | Resolved — log now records `errorClass` (e.g. `"ZodError"`) plus `enquiryId` only. Operators reach the full payload through redacted channels. |

## Phase 16 — Operational-readiness uplift (2026-04-23)

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| PR16-NO-ERRSINK-IMPL | Medium | Phase 15 shipped a sink interface but no wireable implementation | Resolved — `lib/observability/webhook-error-sink.ts` + `instrumentation.ts` auto-register when `EQUISMILE_ERROR_WEBHOOK_URL` is set. |
| PR16-BACKUP-MANUAL | High | Backup was a host cron the operator had to install by hand | Resolved — `backup` compose service runs `pg_dump` on an internal cron; no host setup required. |
| PR16-NO-RESTORE-DRILL | Medium | No mechanical way to verify a backup is restorable | Resolved — `scripts/backup-restore-verify.sh` restores the newest dump into a scratch DB and asserts schema + row presence. |
| PR16-NO-OPS-UI | Medium | No operator-visible view of DLQ depth, audit activity, backup freshness | Resolved — `/api/admin/observability` + `/[locale]/admin/observability` page (admin-only). |
| PR16-PII-SWEEP | Low | Remaining raw phone in confirmation.service and n8n send-whatsapp trigger | Resolved — `maskPhone()` applied to all outbound logs. |

## Phase 15 — Production-readiness uplift (2026-04-23)

Filed and closed during the Phase 15 PR. See
[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for the updated
go-live checklist.

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| PR15-SOFT-DEL | High | Hard deletes on Customer/Yard/Horse cascaded clinical records | Resolved — `deletedAt` / `deletedById` tombstones + repo-level `deletedAt: null` default filter. |
| PR15-DOCKER-ENV | High | Docker compose missing Auth.js / Anthropic / `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` pass-through | Resolved — `env_file: .env` + explicit `args:` for NEXT_PUBLIC_* build-time vars. |
| PR15-NO-BACKUP | High | No backup script or restore runbook | Resolved — `scripts/backup-db.sh` + `docs/BACKUP.md`. |
| PR15-API-RATE | Medium | Only webhook & vision endpoints rate-limited; no floor on authenticated write traffic | Resolved — middleware-level per-user API write-limit (60s / 120 writes). |
| PR15-PII-LOGS | Medium | Raw phone/email in WhatsApp/email/n8n-trigger logs | Resolved — `maskPhone()` / `maskEmail()` wrapped around every outbound log. |
| PR15-NO-ERRSINK | Low | No hook to forward errors to Sentry / log aggregator | Resolved — `registerErrorSink()` in `lib/utils/logger.ts`. |
| PR15-NO-LEGAL | Low | No public privacy notice or terms page | Resolved — `/[locale]/privacy` + `/[locale]/terms` (EN + FR). |
| PR15-NO-TOKENOPS | Low | WhatsApp token lifecycle not documented | Resolved — `docs/OPERATIONS.md` §1. |
| PR15-NO-POOLTUNE | Low | Prisma pool tuning / `pool_timeout` not documented | Resolved — `docs/OPERATIONS.md` §2. |
| PR15-WEAK-DBPW | High | `docker-compose.yml` used `equismile_dev` as a default POSTGRES_PASSWORD | Resolved — compose now fails loud via `${POSTGRES_PASSWORD:?}` with no default; `.env.example` uses an obvious `<strong-password-here>` placeholder. |

## Active Issues

| ID | Phase | Severity | Description | Workaround |
|----|-------|----------|-------------|------------|
| KI-001 | 5 | Low | Google Maps API rate limiting may cause batch geocoding to fail for large batches (50+ yards) | Process in smaller batches of 10–20 |
| ~~KI-002~~ | ~~6~~ | ~~Low~~ | ~~Reminder scheduling depends on `POST /api/reminders/check` being called periodically — no built-in cron~~ | Resolved in Phase 12d |
| KI-003 | 7 | Low | PWA offline queue does not retry mutations in the original submission order if multiple were queued | Mutations are eventually consistent; order rarely matters for this app's use case |
| KI-004 | 3 | Medium | WhatsApp webhook verification requires the app to be publicly accessible — not possible in local dev | Use ngrok or similar tunnel for local WhatsApp testing |
| KI-005 | 4 | Low | Auto-triage confidence scores are heuristic-based and may misclassify edge cases | Manual override is available; triage tasks created for low-confidence classifications |
| KI-006 | 9 | Info | `/api/webhooks/*`, `/api/n8n/*`, and `/api/reminders/check` intentionally bypass session auth and stay behind the separate `N8N_API_KEY` check — by design, because n8n calls them server-to-server without a browser session. Phase 14 PR E hardened this: the key gate now FAILS CLOSED in production (HTTP 500) when `N8N_API_KEY` is unset, instead of silently accepting anonymous traffic. | No action; enforced in `middleware.ts` via `PUBLIC_PATH_PATTERNS` + `lib/utils/signature.ts#requireN8nApiKey`. |
| KI-007 | 14 | Info | In-memory rate limiters (`lib/utils/rate-limit.ts`) do not share state across horizontally-scaled instances. Acceptable for the single-vet single-VPS deploy shape; promote to Redis when the deploy goes multi-node. | No action required for v1 scale. |

## v1.0.0 Retrospective Audit — AMBER items (2026-04-20)

Filed during the [Phase Verification Plan](./PHASE_VERIFICATION_PLAN.md) audit. See [V1_AUDIT_FINDINGS.md](./V1_AUDIT_FINDINGS.md) for the per-phase evidence tables.

| ID | Phase | Severity | Description | Workaround / Recommendation |
|----|-------|----------|-------------|------------------------------|
| ~~AMBER-01~~ | ~~7~~ | ~~Low~~ | ~~Demo-startup exec-bit test fails on Windows~~ | **Closed in-audit** — guarded 3 exec-bit tests with `itPosix` helper in `__tests__/unit/infra/demo-startup.test.ts`; POSIX CI still enforces |
| ~~AMBER-02~~ | ~~1~~ | ~~Low~~ | ~~Brand colour is `#1e40af` (blue) in manifest/layout/globals.css instead of `#9b214d` (maroon) specified in PHASE_1_MASTER_PROMPT § 1.2 and shown in Logo.png~~ | **Resolved** — aligned all four code sites (globals.css, manifest.ts, layout.tsx, RouteMap.tsx) to the spec maroon `#9b214d`. Added `--color-primary-light` (`#c23b6c`) and `--color-primary-dark` (`#6f1738`) tints. |
| ~~AMBER-03~~ | ~~2~~ | ~~Low~~ | ~~Seed counts below Phase 2 target (5c/8y/15h/10e/5vr vs 8/6/20/12/10)~~ | **Resolved by PR #17 (Phase 12d)** — `seed.ts` split into production (minimal) + `seed-demo.ts` (8c/8y/20h/12e) |
| ~~AMBER-04~~ | ~~2~~ | ~~Low~~ | ~~No dedicated `/visit-requests` route~~ | **Resolved in Phase 14 PR D** — added `/[locale]/visit-requests` list page with status + urgency filters. |
| ~~AMBER-05~~ | ~~4~~ | ~~Low~~ | ~~Triage dispositions split across `TriageStatus` + `PlanningStatus` + `TriageTaskType`~~ | **Resolved by docs** in Phase 14 PR D — `docs/ARCHITECTURE.md` now carries an explicit disposition mapping table. |
| ~~AMBER-06~~ | ~~5~~ | ~~Low~~ | ~~Geocoding fields on Yard lack `source`, `precision`, `formattedAddress`~~ | **Resolved in Phase 14 PR D** — added `geocodeSource`, `geocodePrecision`, `formattedAddress` nullable columns via additive migration. |
| ~~AMBER-07~~ | ~~5~~ | ~~Low~~ | ~~`RouteRun`/`RouteRunStop` used instead of master prompt's `RouteProposal`/`RouteStop`~~ | **Resolved by docs** in Phase 14 PR D — explicit rename rationale + mapping in `docs/ARCHITECTURE.md`. |
| ~~AMBER-08~~ | ~~6~~ | ~~Medium~~ | ~~Single `AppointmentStatus` enum instead of separate Booking/Confirmation/Reminder enums~~ | **Resolved by docs** in Phase 14 PR D — rationale in `docs/ARCHITECTURE.md`; multi-send audit now captured by `ConfirmationDispatch` (AMBER-10). |
| AMBER-09 | 6 | Low | No explicit `AppointmentHorse` link table; horses inferred from VisitRequest relation | Adequate if per-appointment horse metadata (order, per-horse duration) is not tracked |
| ~~AMBER-10~~ | ~~6~~ | ~~Medium~~ | ~~No `ConfirmationDispatch` event log~~ | **Resolved in Phase 14 PR D** — `ConfirmationDispatch` table + `appointmentAuditService.logConfirmationDispatch`; every send attempt (success or failure) recorded. |
| ~~AMBER-11~~ | ~~6~~ | ~~Medium~~ | ~~No `AppointmentResponse` model~~ | **Resolved in Phase 14 PR D** — `AppointmentResponse` table + `appointmentAuditService.logResponse`; captures inbound confirm/cancel/reschedule replies linked directly to the appointment. |
| ~~AMBER-12~~ | ~~6~~ | ~~Low~~ | ~~No `ReminderSchedule` queue~~ | **Resolved by docs** in Phase 14 PR D — inline timestamps + idempotent cron are adequate for single-vet scale; promotion plan documented in `docs/ARCHITECTURE.md`. |
| ~~AMBER-13~~ | ~~6~~ | ~~Low~~ | ~~No `AppointmentStatusHistory` table~~ | **Resolved in Phase 14 PR D** — `AppointmentStatusHistory` table; booking / reschedule / visit-outcome services write history rows in the same transaction as status mutations. |
| ~~AMBER-14~~ | ~~7~~ | ~~Medium~~ | ~~Idempotency key store is in-memory (`processedKeys: Set<string>`) — lost on restart and not shared across instances~~ | **Resolved by phase 13** — `IdempotencyKey` Prisma model + `lib/services/idempotency.service.ts` (Postgres-backed). `hasBeenProcessed`/`markAsProcessed` are now async. Survives restarts, shared across instances, 30-day TTL with `pruneExpired()` cron. |
| ~~AMBER-15~~ | ~~7~~ | ~~Low~~ | ~~No dead-letter queue for permanent failures after `maxRetries`~~ | **Resolved in Phase 14 PR D** — `FailedOperation` table + `deadLetterService`. `whatsappService` and `emailService` enqueue permanent failures; operators replay via `deadLetterService.markStatus`. Payloads scrubbed with `redact()` before storage. |
| ~~AMBER-16~~ | ~~7~~ | ~~Low~~ | ~~No direct unit test for retry.ts~~ | **Retracted** — `__tests__/unit/utils/retry.test.ts` already exists with full coverage |

## Resolved Issues

| ID | Phase | Description | Resolution |
|----|-------|-------------|------------|
| KI-002 | 6 | Reminder scheduling had no built-in cron | Added `n8n/07-reminder-scheduling.json` — n8n workflow triggers `GET /api/reminders/check` every 15 minutes |

## Conventions

- Log issues discovered during development or UAT here
- Include phase, severity (low/medium/high/critical), and description
- Add workaround if available
- Move to Resolved section when fixed, with resolution notes
- Remove from Resolved after one release cycle
