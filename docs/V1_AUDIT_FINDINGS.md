# EquiSmile v1.0.0 — Retrospective Audit Findings

Companion to [PHASE_VERIFICATION_PLAN.md](./PHASE_VERIFICATION_PLAN.md).

**Audit started:** 2026-04-20
**Auditor:** Claude Code (automated retrospective pass)
**Repo HEAD at audit start:** `fbafbd9` (main, v1.0.0 post-launch fixes only)
**Current HEAD at audit publication:** `3e295ba` (includes Phase 12 PRs #13–#17)
**Tag:** `rc/v1.0.0`

## State drift notice — Phase 12 landed during audit

Between audit start (commit `fbafbd9`) and publication, five PRs merged to `main`:

| PR | Commit | Scope |
|---|---|---|
| #13 | `27e6ada` | LAUNCH.bat + `/api/status` diagnostic endpoint |
| #14 | `23b8987` | Working-day hard constraints + RouteMap error boundary |
| #15 | `9b59112` | Phase 12c — completed visits, triage API, n8n workflow |
| #16 | `8729df8` | Per-horse service duration in `optimizeTours` + tests |
| #17 | `3e295ba` | Phase 12d — Caddy, reminders, security, seed split, IMAP cleanup |

**Impact on findings:**
- **AMBER-03 resolved by PR #17** — seed split into production (`seed.ts`, minimal) + demo (`seed-demo.ts`, 8 customers / 8 yards / 20 horses / 12 enquiries — meets Phase 2 targets).
- **KI-002 (previously known)** — resolved by PR #17 via `n8n/07-reminder-scheduling.json` cron. Note: AMBER-12 (no `ReminderSchedule` queue *model*) is a separate design-model gap and is still open.
- All other AMBERs re-verified against the Phase 12 diff: files touching manifest/layout/globals.css (AMBER-02), triage enums (AMBER-05), Yard geocoding fields (AMBER-06), RouteRun naming (AMBER-07), Appointment models (AMBER-08–13), retry/idempotency (AMBER-14/15) were **not materially altered**. AMBERs stand.

---

## Baseline

All commands run from `D:/Projects/Equismile/equismile`.

| Check | Result | Evidence |
|---|---|---|
| `npx prisma validate` | GREEN | "The schema at prisma\schema.prisma is valid" |
| `npm run lint` | GREEN | 0 errors, 3 warnings (unused `err`/`_text` in setup/demo simulators — cosmetic) |
| `npx prisma generate` | GREEN (required preflight) | Prisma Client v6.6.0 generated to `node_modules/@prisma/client` |
| `npm run typecheck` | GREEN after `prisma generate` | Exit 0; zero TS errors |
| `npm run test` | **GREEN after in-audit fix** | Initial: 526/529 pass (3 fails in demo-startup.test.ts — Windows NTFS exec-bit). Remediated: guarded exec-bit assertions with `itPosix` helper; final 60/60 files, 526 pass + 3 skipped on Windows |
| `npm run build` | GREEN | Build completes; route manifest shows all expected API + page routes |

**AMBER-01 — demo-startup exec-bit test fails on Windows** ✅ **CLOSED IN-AUDIT**
Scripts at `scripts/demo-start.sh`, `scripts/demo-start-local.sh`, and `docker/init-databases.sh` have no executable bit on NTFS, so `stat.mode & 0o111 > 0` failed. Remediated in the audit by adding `const itPosix = process.platform === 'win32' ? it.skip : it;` to `__tests__/unit/infra/demo-startup.test.ts` and guarding the three exec-bit assertions. Re-run: 60/60 files, 526 pass + 3 skipped on Windows (all would still assert on POSIX CI).

---

## Phase 0 — Scaffold

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 0.1 | Tooling & config | GREEN | `package.json`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `docker-compose.yml`, `vitest.config.ts` all present at repo root |
| 0.2 | Docs skeleton | GREEN | `docs/` contains ARCHITECTURE, BUILD_PLAN, TEST_STRATEGY, PR_REVIEW_CHECKLIST, KNOWN_ISSUES, SETUP, DEPLOYMENT, N8N_CONTRACT, PRODUCTION_READINESS, RELEASE_NOTES_v1.0.0, migration-safety |
| 0.3 | n8n workflow JSONs 01–06 | GREEN | `n8n/01-inbound-whatsapp.json` through `n8n/06-approval-and-confirmations.json` present |
| 0.4 | Prisma schema | GREEN | `prisma/schema.prisma` — 15 enums + 13 models (Customer, Yard, Horse, Enquiry, EnquiryMessage, VisitRequest, TriageTask, TriageAuditLog, RouteRun, RouteRunStop, Appointment, VisitOutcome); `prisma validate` passes |
| 0.5 | Next.js App Router shell + `[locale]` | GREEN | `app/[locale]/` with pages: appointments, completed, customers, dashboard, demo, enquiries, horses, planning, route-runs, triage, yards; `i18n/` has navigation/request/routing; `messages/en.json` + `messages/fr.json` |
| 0.6 | CI workflow | GREEN | `.github/workflows/ci.yml` present |
| 0.7 | CLAUDE.md + `.claude/` | GREEN | Both present |
| 0.8 | Five non-negotiable checks pass | GREEN on 4/5; AMBER on tests | See Baseline table and AMBER-01 |

**Phase 0 verdict: GREEN** (with AMBER-01 logged against Phase 7 as it originated in later tests, not in the Phase 0 scaffold).

## Phase 1 — Foundation

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 1.1 | Clean App Router + `npm run build` passes | GREEN | Build output exit 0; full route manifest generated |
| 1.2 | PWA shell (manifest, sw, 44px targets, bottom nav, brand `#9b214d`) | **AMBER** | `app/manifest.ts` + `app/sw.ts` present; 44px media query in `app/globals.css:55-59`; `components/layout/MobileNav.tsx` present. **Brand colour gap (AMBER-02):** manifest/layout/globals.css use `#1e40af` (blue) not `#9b214d` (maroon) mandated by master prompt § 1.2 |
| 1.3 | Docker Compose + SETUP.md | GREEN | `docker-compose.yml` present; `docs/SETUP.md` has verified `docker compose up -d` startup sequence (lines 48-65) |
| 1.4 | Prisma baseline migration | GREEN | `prisma/migrations/` has `20260415000000_init_equine_vet` + 4 subsequent additive migrations; `prisma validate` passes |
| 1.5 | Seed idempotent + min data | GREEN | `prisma/seed.ts` uses `upsert` (34 upsert calls) keyed on `email`/`id`; produces 5 customers (3 EN + 2 FR), 8 yards with UK postcodes + 2 FR yards, 15 horses, 10 enquiries, 5 visit requests — exceeds Phase 1 minimums. Phase 2 realism targets partially met (logged under Phase 2) |
| 1.6 | Env validation with named errors | GREEN | `lib/env.ts` uses zod with named fields; error message includes `path.join('.')` per issue (lines 73-80); `.env.example` present |
| 1.7 | Health check with db/env/n8n | GREEN (exceeds) | `app/api/health/route.ts` returns db (with latency), environment (with missing list), n8n (with url) — plus whatsapp/smtp/googleMaps extras. Returns 503 when unhealthy |
| 1.8 | CI passing | GREEN | Baseline: lint/typecheck/test/validate/build all green (tests AMBER-01 Windows-only) |
| 1.9 | Mobile viewport QA | GREEN (static evidence) | `viewport` export in `app/[locale]/layout.tsx:18-23`; MobileNav exists; 44px CSS rule. No screenshot capture in this pass — manual QA evidence in `docs/uat/` TC-006 mobile UX covers the responsive gates |

**AMBER-02 — Brand colour mismatch**
Phase 1 master prompt § 1.2 specifies deep maroon `#9b214d`. Current implementation uses blue `#1e40af` in: `app/manifest.ts:12`, `app/[locale]/layout.tsx:22`, `app/globals.css:4`, `components/maps/RouteMap.tsx:64`. Logo.png shows maroon branding — indicates accepted post-Phase-1 design drift or incomplete Phase 1 remediation. Recommend logging in `docs/KNOWN_ISSUES.md` and deciding at sign-off whether to (a) align code to `#9b214d`, (b) update master prompt retroactively to record the blue decision.

**Phase 1 verdict: GREEN with 1 AMBER** (AMBER-02)

## Phase 2 — Core Features

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 2.1 | Prisma entities (Customer, Yard, Horse, Enquiry, VisitRequest, TriageTask, TriageAuditLog, RouteRun, Appointment, VisitOutcome) | GREEN | `prisma/schema.prisma` — 13 models covering all required entities plus enums |
| 2.2 | Realistic demo seed (8c/6y/20h/12e/10vr) | **RESOLVED (PR #17)** | At audit anchor `fbafbd9`: 5c/8y/15h/10e/5vr → AMBER-03. At HEAD `3e295ba`: `prisma/seed-demo.ts` has 8 customers, 8 yards, 20 horses, 12 enquiries — meets Phase 2 targets. `prisma/seed.ts` is a minimal production stub by design |
| 2.3 | Core internal pages | **AMBER** | Present: `/dashboard`, `/enquiries` (list + new + detail), `/customers`, `/yards`, `/horses`, `/triage`, `/planning`, `/appointments`, `/completed`, `/route-runs`, `/demo`. Missing dedicated `/visit-requests` route (AMBER-04) — visit requests are nested under enquiries and planning pages instead |
| 2.4 | Dashboard urgent/routine/planning/missing-info counts | GREEN | `app/[locale]/dashboard/page.tsx:29-34` — `urgentCount`, `needsInfoCount`, `planningPoolCount`, `activeCustomers` |
| 2.5 | Manual enquiry creation form with validation | GREEN | `app/[locale]/enquiries/new/page.tsx` + `lib/validations/manual-enquiry.schema.ts` (zod) |
| 2.6 | Triage workflow with rule-based urgency detection | GREEN | `lib/services/triage-rules.service.ts` + `auto-triage.service.ts` + `lib/services/triage.service.ts`; `app/[locale]/triage/page.tsx` |
| 2.7 | Planning pool view with area/postcode grouping | GREEN | `app/[locale]/planning/page.tsx` + `lib/services/planning.service.ts` |
| 2.8 | Repository/service layer discipline | GREEN | `lib/repositories/` (8 repos: customer, yard, horse, enquiry, visit-request, triage-task, route-run, appointment); `lib/services/` (21 services) |
| 2.9 | Unit + integration tests for core flows | GREEN | 60 test files across `__tests__/unit/` and `__tests__/integration/`; 529 tests total (526 pass; 3 Windows-only fails per AMBER-01) |

**AMBER-03 — Seed realism below Phase 2 target — ✅ RESOLVED BY PR #17**
At audit anchor `fbafbd9`: 5/8/15/10/5 vs Phase 2 target 8/6/20/12/10. PR #17 (commit `3e295ba`) split the seed: `prisma/seed.ts` is now a minimal production seed (customers created via intake only); `prisma/seed-demo.ts` is the rich demo fixture meeting Phase 2 targets. Locale shifted to Swiss/French villages for bilingual testing.

**AMBER-04 — No standalone `/visit-requests` route**
Phase 2 master prompt § 2.3 lists `/visit-requests` as an expected page. Implementation routes visit requests through `/enquiries/[id]` (linked from enquiry) and `/planning` (pool view). This is a reasonable UX consolidation but diverges from the prompt. Low impact — all visit-request data is visible and actionable.

**Phase 2 verdict: GREEN with 1 active AMBER** (AMBER-04) — AMBER-03 resolved by PR #17

## Phase 3 — Messaging Intake

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 3.1 | Inbound message domain contract | GREEN | `docs/N8N_CONTRACT.md` documents typed endpoints; `app/api/webhooks/whatsapp/route.ts` uses typed WhatsAppPayload/Message/Contact/Change interfaces |
| 3.2 | Message logging model | GREEN | `EnquiryMessage` model in `prisma/schema.prisma:215-229` with `externalMessageId` unique constraint; `lib/services/message-log.service.ts` |
| 3.3 | WhatsApp GET verification | GREEN | `app/api/webhooks/whatsapp/route.ts:14-27` checks `hub.mode=subscribe` + `hub.verify_token`, returns `hub.challenge` |
| 3.4 | WhatsApp POST ingestion + signature verification | GREEN | `route.ts:67-76` uses `verifyWhatsAppSignature(rawBody, x-hub-signature-256, WHATSAPP_APP_SECRET)`; `lib/utils/signature.ts` with dedicated test in `__tests__/unit/utils/signature.test.ts` |
| 3.5 | Email/IMAP intake | GREEN | `app/api/webhooks/email/route.ts` + `n8n/02-inbound-email.json` workflow; `__tests__/unit/api/webhooks/email.test.ts` + integration test |
| 3.6 | Shared pipeline (validate → dedupe → log → customer → enquiry) | GREEN | `lib/services/message-log.service.ts`, `lib/services/enquiry.service.ts`, `lib/services/customer.service.ts` — unit-tested |
| 3.7 | Dedupe via externalMessageId @unique | GREEN | `prisma/schema.prisma:192,222`; upsert pattern in seed + service layer |
| 3.8 | Customer/enquiry conservative matching (phone/email) | GREEN | `lib/utils/phone.ts` normalisation; `lib/services/customer.service.ts` match logic |
| 3.9 | Message log visibility | GREEN | Enquiry detail page reads `messages` relation; visible on `/enquiries/[id]` |
| 3.10 | Tests (verification, parsing, dedupe, matching) | GREEN | `__tests__/unit/api/webhooks/whatsapp.test.ts`, `email.test.ts`, `api/n8n/contract.test.ts`, `utils/signature.test.ts`, `services/message-log.service.test.ts`, plus `integration/whatsapp-webhook.integration.test.ts` + `email-intake.integration.test.ts` |

**Phase 3 verdict: GREEN** (no AMBERs)

## Phase 4 — Triage Operations

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 4.1 | Triage decision dispositions | **AMBER** | Intent covered via split enums but vocabulary differs. `TriageStatus`: NEW/PARSED/NEEDS_INFO/TRIAGED; `PlanningStatus`: UNTRIAGED→…→BOOKED/COMPLETED/CANCELLED (8 states); `TriageTaskType`: URGENT_REVIEW/ASK_FOR_POSTCODE/ASK_HORSE_COUNT/CLARIFY_SYMPTOMS/MANUAL_CLASSIFICATION. Master prompt §4.1 listed 7 specific dispositions (urgent_review, same_week_priority, ready_for_planning, missing_information, admin_only, no_action, closed_duplicate) — direct mapping incomplete. AMBER-05 |
| 4.2 | Triage review queue UI | GREEN | `app/[locale]/triage/page.tsx` with filters |
| 4.3 | Missing-info loop (categories, follow-up, resolution) | GREEN | `lib/services/missing-info.service.ts`; `TriageTaskType.ASK_FOR_POSTCODE/ASK_HORSE_COUNT/CLARIFY_SYMPTOMS`; `followUpAttempts` + `lastFollowUpAt` fields on VisitRequest |
| 4.4 | Manual override flow with audit | GREEN | `lib/services/override.service.ts`; `app/api/triage-ops/override/route.ts`; `TriageAuditLog` model; tests in `override.service.test.ts` |
| 4.5 | Escalation flow | GREEN | `TriageTask.escalatedAt` field; `app/api/triage-ops/follow-up/route.ts`; `app/api/triage-ops/audit/route.ts` |
| 4.6 | Operational status machine | GREEN | `lib/services/status-machine.service.ts` with typed transition maps for TriageStatus/PlanningStatus/TriageTaskStatus; rejects invalid jumps |
| 4.7 | Service-layer enforcement of transitions | GREEN | `status-machine.service.ts` is the enforcement point; called from override/missing-info services |
| 4.8 | Timelines / audit entries | GREEN | `TriageAuditLog` model with transition entries; surfaced via `/api/triage-ops/audit` |
| 4.9 | Dashboard refinements (urgent awaiting, escalations, ageing) | GREEN | Dashboard stats include `urgentCount`, `needsInfoCount`; planning-pool counts visible; ageing implied via `receivedAt`/`createdAt`/`lastFollowUpAt` fields |
| 4.10 | Tests for disposition logic, transitions, loops, overrides | GREEN | `triage-rules.service.test.ts`, `triage.service.test.ts`, `status-machine.service.test.ts`, `override.service.test.ts`, `missing-info.service.test.ts`, `integration/triage-pipeline.integration.test.ts` |

**AMBER-05 — Triage disposition vocabulary diverges from master prompt**
The master prompt § 4.1 listed 7 specific disposition names. Implementation split these across three enums (TriageStatus/PlanningStatus/TriageTaskType) totalling 17 states. Functional intent is preserved (urgency detection, missing-info path, ready-for-planning flow, cancellation, escalation), but the exact disposition vocabulary is not present. Recommend either (a) accepting the refactor as superior separation of concerns, or (b) adding a documented mapping in `docs/ARCHITECTURE.md` to clarify how the 7 prompt dispositions map to the implemented states.

**Phase 4 verdict: GREEN with 1 AMBER** (AMBER-05)

## Phase 5 — Route Planning

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 5.1 | Geocoding fields on Yard | **AMBER** | `Yard.latitude`, `longitude`, `geocodeFailed`, `geocodedAt`, `postcode`, `areaLabel` present. Missing explicit `source`, `precision`, `formattedAddress` fields from master prompt § 5.1. Covered functionally by separate fields + single `geocodeFailed` boolean. AMBER-06 |
| 5.2 | Geocoding pipeline + retry + dedupe | GREEN | `lib/services/geocoding.service.ts`; `app/api/route-planning/geocode/route.ts`; `n8n/04-yard-geocoding.json`; tested in `geocoding.service.test.ts` |
| 5.3 | Planning eligibility rules | GREEN | `lib/services/planning.service.ts` + `route-proposal.service.ts` enforce status + geocode-success + disposition gates; test coverage in `route-proposal-constraints.test.ts` |
| 5.4 | Clustering layer | GREEN | `lib/services/clustering.service.ts`; `Yard.areaLabel` + `postcode` indexed for grouping; `clustering.service.test.ts` |
| 5.5 | Route scoring | GREEN | `lib/services/route-scoring.service.ts` — tested in `route-scoring.service.test.ts` |
| 5.6 | Route planning entities | **AMBER** | `RouteRun` + `RouteRunStop` with status, score, duration, stop sequence, travel/service minutes, generated-at (`createdAt`). Vocabulary differs from master prompt "RouteProposal"/"RouteStop" but shape matches. AMBER-07 |
| 5.7 | Google Route Optimization integration | GREEN | `lib/services/route-optimizer.service.ts` — payload builder + response parser isolated; `route-optimizer.service.test.ts` |
| 5.8 | Vehicle/day settings | GREEN | `RouteRun.runDate`, `homeBaseAddress`, `startTime`, `endTime`; env vars `HOME_BASE_ADDRESS/LAT/LNG` + `ROUTE_START_TIME/END_TIME` in `lib/env.ts` |
| 5.9 | Proposal review UI with approval flow | GREEN | `app/[locale]/route-runs/[id]/page.tsx` + `app/api/route-planning/proposals/[id]/route.ts` with approve/reject |
| 5.10 | Spatial review aid | GREEN | `components/maps/RouteMap.tsx` — Google Maps rendering of stops |
| 5.11 | n8n orchestration hooks | GREEN | `n8n/05-route-planning.json`; `/api/n8n/route-proposal/route.ts`; `/api/n8n/geocode-result/route.ts` |
| 5.12 | Error resilience | GREEN | Retry wrapper utility; `geocodeFailed` flag; failed stops don't crash pipeline |
| 5.13 | Tests across pipeline | GREEN | geocoding, clustering, route-optimizer, route-scoring, route-proposal, route-proposal-constraints + `integration/route-planning.integration.test.ts` |

**AMBER-06 — Geocoding fields minimal vs master-prompt spec**
Master prompt § 5.1 lists source/status/formatted-address/postcode/precision/timestamp. Current schema covers timestamp (`geocodedAt`), postcode (`postcode`), pass/fail state (`geocodeFailed`), lat/long. Missing `source`, `precision`, `formattedAddress`. Low impact — source is always Google Geocoding, precision can be inferred, formatted address can be derived. Recommend logging and accepting; or extending schema additively if Phase 5 audit rigor is required.

**AMBER-07 — RouteRun/RouteRunStop naming vs RouteProposal/RouteStop**
Functional shape identical; only the model name differs. Vocabulary drift from master prompt. Recommend accepting — "RouteRun" reads better operationally (a run of the day) than "RouteProposal". Update `docs/ARCHITECTURE.md` to clarify terminology.

**Phase 5 verdict: GREEN with 2 AMBERs** (AMBER-06, AMBER-07)

## Phase 6 — Booking & Confirmations

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 6.1 | Appointment model with booking/confirmation/reminder fields | **AMBER** | `Appointment` exists with `status`, `confirmationChannel`, `confirmationSentAt`, `reminderSentAt24h`, `reminderSentAt2h`, `cancellationReason`, `appointmentStart/End`, linked to VisitRequest + RouteRun. Single `AppointmentStatus` enum (PROPOSED/CONFIRMED/COMPLETED/CANCELLED/NO_SHOW) collapses the three separate status tracks recommended in PHASE_6_DATA_MODEL.md. AMBER-08 |
| 6.2 | AppointmentHorse link table | **AMBER** | Not implemented. Horses linked indirectly via VisitRequest → Horse relation (a visit request has many horses). Per-appointment horse metadata not tracked. AMBER-09 |
| 6.3 | ConfirmationDispatch event log | **AMBER** | Not implemented. Inline fields `confirmationSentAt` + `confirmationChannel` only record latest send. Multiple attempts not preserved as separate events. AMBER-10 |
| 6.4 | AppointmentResponse inbound replies | **AMBER** | Not implemented. Responses flow through EnquiryMessage; linkage to specific Appointment is indirect. AMBER-11 |
| 6.5 | ReminderSchedule queue | **AMBER** | Not implemented as a queue table. Reminders are sent inline via `app/api/reminders/check/route.ts` (polled/cron-style). AMBER-12 |
| 6.6 | AppointmentStatusHistory | **AMBER** | Not implemented. Status changes tracked via `updatedAt` and `TriageAuditLog` but not an appointment-specific history. AMBER-13 |
| 6.7 | Approved-proposal → appointment conversion | GREEN | `lib/services/booking.service.ts:bookRouteRun` uses `prisma.$transaction` for atomicity; called from `app/api/route-planning/proposals/[id]/route.ts` after approval |
| 6.8 | Booking review UI | GREEN | `app/[locale]/appointments/[id]/page.tsx`; `/appointments` list page |
| 6.9 | Bilingual confirmation templates | GREEN | `lib/services/confirmation.service.ts`, `email.service.ts`, `whatsapp.service.ts` support EN/FR per customer's `preferredLanguage` field |
| 6.10 | Dispatch workflow | GREEN | `confirmation.service.ts` + `n8n/06-approval-and-confirmations.json`; duplicate prevention via `confirmationSentAt` check |
| 6.11 | Response mapping | AMBER | Handled via EnquiryMessage matching by phone/email, but not to specific appointment (AMBER-11) |
| 6.12 | Cancel/reschedule flow | GREEN | `lib/services/reschedule.service.ts`; `cancellationReason` field; tested in `reschedule.service.test.ts` |
| 6.13 | Reminder workflow (24h/2h) | GREEN | `lib/services/reminder.service.ts`; `app/api/reminders/check/route.ts`; `reminderSentAt24h`/`2h` fields prevent duplicate sends |
| 6.14 | Status sync to VisitRequest / daily ops | GREEN | `booking.service.ts` updates visit request planning status; status machine transitions |
| 6.15 | Booking queues UI | GREEN | `/appointments` + `/completed` pages with filters |
| 6.16 | Audit trail | AMBER | TriageAuditLog covers triage/override/escalation; no dedicated appointment audit (AMBER-13) |
| 6.17 | Tests | GREEN | `booking.service.test.ts`, `confirmation.service.test.ts`, `reminder.service.test.ts`, `reschedule.service.test.ts`, `visit-outcome.service.test.ts`, `integration/booking-flow.integration.test.ts` |

**AMBER-08 through AMBER-13 — Phase 6 data-model simplification vs design brief**
`PHASE_6_DATA_MODEL.md` (written by GPT-5.4 Thinking as a design proposal) recommended 6 additional tables and 3 separate status enums for richer operational tracking. Implementation chose a simpler single-Appointment-table design with inline status/reminder fields. This is adequate for a single-vet operation but loses granularity for:
- Multi-horse appointment metadata (AMBER-09)
- Multi-attempt confirmation dispatch tracking (AMBER-10)
- Inbound customer response → appointment linkage (AMBER-11)
- Queueable/cancellable reminder schedule (AMBER-12)
- Appointment-specific status history (AMBER-13)

Recommendation: accept simplification for v1.0 scope; revisit in v1.1 if operational needs demand richer tracking. If accepted, document the design decision in `docs/ARCHITECTURE.md` with reference to this audit finding.

**Phase 6 verdict: GREEN with 6 AMBERs** (AMBER-08 through AMBER-13)

## Phase 7 — Hardening & Polish

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 7.1 | Retry + circuit breaker wrapper | GREEN | `lib/utils/retry.ts` — exponential backoff + jitter + per-attempt timeout + CircuitBreaker class + pre-built breakers for whatsapp/email/geocoding/routeOptimization/n8n; used by whatsapp.service, email.service, geocoding.service, route-optimizer.service |
| 7.2 | Idempotency helpers | GREEN | `generateIdempotencyKey`, `hasBeenProcessed`, `markAsProcessed` in `retry.ts`. Note: in-memory only — production-readiness comment calls out needing Redis/DB backing. AMBER-14 |
| 7.3 | Structured JSON logging | GREEN | `lib/utils/logger.ts` with `createTimer` + correlation IDs; used in health, webhooks, services |
| 7.4 | Sensitive-data masking | GREEN (partial) | Health check masks `token` in WhatsApp verification logs (`route.ts:25`); other services use typed logger. Full masking audit not performed in this pass. |
| 7.5 | Error boundary + toast + offline banner | GREEN | `components/ui/ErrorBoundary.tsx`, `components/ui/Toast.tsx`, `components/ui/OfflineBanner.tsx` wired in `app/[locale]/layout.tsx` |
| 7.6 | Accessibility (semantic HTML, kbd nav, focus, labels, contrast, 44px) | GREEN | `components/ui/SkipToContent.tsx`; `:focus-visible` outline in globals.css; `FormField.tsx` with labels; 44px media query; WCAG 2.1 AA documented in RELEASE_NOTES |
| 7.7 | Performance (lazy, skeletons, pagination, bundle) | GREEN | `components/ui/Skeleton.tsx`, `Pagination.tsx`, `LoadingState.tsx`; Next.js App Router default RSC + code splitting |
| 7.8 | Mobile polish (safe-area, bottom-sheet, sticky nav) | GREEN | `.pb-safe` class in globals.css (line 48-52); `components/ui/BottomSheet.tsx`; `MobileNav.tsx` bottom-anchored |
| 7.9 | Prisma production migration safety | GREEN | `docs/migration-safety.md` documents additive-only strategy; 5 migrations committed; `migrate deploy` in deploy guide |
| 7.10 | Queue resiliency + dead-letter | **AMBER** | Retry handles transient failures; no explicit dead-letter queue for permanent failures. Stalled-item detection not implemented as a separate mechanism — relies on `lastFollowUpAt` ageing. AMBER-15 |
| 7.11 | Tests for retry + a11y + perf-sensitive paths | GREEN (partial) | Retry logic tested indirectly via services using `withRetry`. Dedicated retry unit test not present (AMBER-16). A11y snapshot tests not present. |
| 7.12 | Documentation (retry strategy, idempotency, logging, a11y) | GREEN | `docs/PRODUCTION_READINESS.md` covers deployment + monitoring; `docs/TEST_STRATEGY.md`; retry is self-documented in `lib/utils/retry.ts` |

**AMBER-14 — Idempotency is in-memory**
`processedKeys = new Set<string>()` is per-process. Restart loses state. Documented as needing Redis/DB for production. Low risk for single-vet single-server deployment; higher risk if horizontally scaled.

**AMBER-15 — No explicit dead-letter for permanent failures**
After `maxRetries`, `RetryError` is thrown and logged, but there's no persistent quarantine/DLQ for the failed item. Mitigated by: external services (n8n) also retry independently, and `geocodeFailed` flag on Yard.

**AMBER-16 — RETRACTED**
On re-check, `__tests__/unit/utils/retry.test.ts` exists (154 lines) covering withRetry success/retry/exhaustion, non-retryable errors, CircuitBreaker state transitions (closed/open/half-open), reset timeout, and idempotency key helpers. The initial audit grep missed it; finding retracted.

**AMBER-01** closed during audit (see Baseline).

**Phase 7 verdict: GREEN with 2 active AMBERs** (AMBER-14 in-memory idempotency, AMBER-15 no DLQ)

## Phase 8 — UAT & Launch

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 8.1 | `rc/v1.0.0` tag | GREEN | `git tag -l` shows `rc/v1.0.0` |
| 8.2 | CHANGELOG.md | GREEN | Present; documents Phase 0 through Phase 8 changes for 1.0.0 release dated 2026-04-15 |
| 8.3 | Release notes | GREEN | `docs/RELEASE_NOTES_v1.0.0.md` comprehensive — features, tech stack, getting started |
| 8.4 | UAT test scripts TC-001…TC-008 | GREEN | `docs/uat/` has TC-001 customer mgmt, TC-002 enquiry intake, TC-003 triage, TC-004 route planning, TC-005 booking confirmations, TC-006 mobile PWA, TC-007 bilingual, TC-008 error handling + UAT_PLAN.md |
| 8.5 | Environment validation script | GREEN | `scripts/validate-environment.ts` + npm script `validate-env`; tested in `__tests__/unit/scripts/validate-environment.test.ts` |
| 8.6 | Production readiness checklist | GREEN | `docs/PRODUCTION_READINESS.md` present |
| 8.7 | Deployment guide with rollback | GREEN | `docs/DEPLOYMENT.md` covers prod deployment; `docs/migration-safety.md` for schema rollback strategy |
| 8.8 | Enhanced demo seed | GREEN | `prisma/seed-demo.ts` + `npm run db:seed-demo` |
| 8.9 | Multi-stage production Dockerfile | GREEN | `Dockerfile` with `FROM node:20-alpine AS base` (multi-stage detected) |
| 8.10 | CI/CD enhancements | GREEN | `.github/workflows/ci.yml` present; CHANGELOG mentions Docker build test + security audit + production build verification |
| 8.11 | Final documentation update | GREEN | Docs inventory confirmed in baseline exploration (11 files + uat subdir) |

**Phase 8 verdict: GREEN** (no AMBERs)

## Phase 9 — Production Readiness

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 9.1 | Demo mode toggle | GREEN | `lib/demo/demo-mode.ts` + `DEMO_MODE` env var in `lib/env.ts`; simulators: whatsapp-simulator.ts, email-simulator.ts, maps-simulator.ts |
| 9.2 | Integration abstraction layer | GREEN | `lib/integrations/` — whatsapp.client.ts, email (smtp.client.ts), google-maps.client.ts, n8n.client.ts — swappable mock/real |
| 9.3 | Docker stack end-to-end | GREEN | `docker-compose.yml` + `Dockerfile` (multi-stage) + `docker/init-databases.sh` for Postgres init |
| 9.4 | README demo quick-start | GREEN | README.md shows Demo Mode quick-start with Docker + scripts; DEMO.bat/FIX.bat/REBUILD.bat present at repo root |
| 9.5 | No regressions post #10 | GREEN | Commits after d122d08 are isolated fixes (triage page crash, dashboard links, DEMO.bat prod build, migration for Enquiry.updatedAt, API key removal, one-click FIX.bat). All fixes target real bugs; none contradict #10 scope |
| 9.6 | `integration/demo-mode.integration.test.ts` | GREEN | Present in integration tests |

**Phase 9 verdict: GREEN** (no AMBERs)

---

## Summary

### Per-phase totals

| Phase | GREEN criteria | AMBER criteria | RED criteria | Verdict |
|---|---:|---:|---:|---|
| 0 Scaffold | 8 | 0 | 0 | GREEN |
| 1 Foundation | 8 | 1 (brand colour) | 0 | GREEN with AMBER |
| 2 Core Features | 7 | 1 active (visit-requests route); 1 resolved by PR #17 (seed counts) | 0 | GREEN with AMBER |
| 3 Messaging Intake | 10 | 0 | 0 | GREEN |
| 4 Triage Operations | 9 | 1 (disposition vocabulary) | 0 | GREEN with AMBER |
| 5 Route Planning | 11 | 2 (geocoding fields, proposal naming) | 0 | GREEN with AMBER |
| 6 Booking & Confirmations | 11 | 6 (simpler data model than design brief) | 0 | GREEN with AMBER |
| 7 Hardening & Polish | 10 | 2 (in-memory idempotency, no DLQ) | 0 | GREEN with AMBER |
| 8 UAT & Launch | 11 | 0 | 0 | GREEN |
| 9 Production Readiness | 6 | 0 | 0 | GREEN |
| **Totals** | **91** | **13 active** (1 closed in-audit, 1 retracted, 1 resolved by PR #17) | **0** | **All phases GREEN with AMBER log** |

### Active AMBERs by severity (after Phase 12 reconciliation)

- **Medium** (4): AMBER-08 appointment status enum consolidation, AMBER-10 no confirmation-dispatch log, AMBER-11 no appointment-response model, AMBER-14 in-memory idempotency
- **Low** (9): AMBER-02 brand colour, AMBER-04 no visit-requests route, AMBER-05 triage vocabulary, AMBER-06 geocoding fields, AMBER-07 RouteRun naming, AMBER-09 no AppointmentHorse, AMBER-12 no reminder queue model, AMBER-13 no appointment status history, AMBER-15 no DLQ
- **Resolved by PR #17**: AMBER-03 seed counts

All AMBERs logged in `docs/KNOWN_ISSUES.md`.

### In-audit remediations and state drift

- **AMBER-01 closed** — cross-platform guard for `__tests__/unit/infra/demo-startup.test.ts`; 60/60 test files pass on Windows.
- **AMBER-16 retracted** — direct retry unit test already exists at `__tests__/unit/utils/retry.test.ts`.
- **AMBER-03 resolved by PR #17** — seed split landed on main during audit; demo-seed now meets Phase 2 targets.
- **KI-002 resolved by PR #17** — reminder cron added via `n8n/07-reminder-scheduling.json` (does not affect AMBER-12 which is a separate design-model gap).

### Non-negotiable checks — final state

| Check | Status |
|---|---|
| `npx prisma validate` | ✅ GREEN |
| `npm run lint` | ✅ GREEN (3 cosmetic warnings) |
| `npm run typecheck` | ✅ GREEN |
| `npm run test` | ✅ GREEN (60 files, 526 pass + 3 platform-skipped) |
| `npm run build` | ✅ GREEN |

## Sign-off

**Audit outcome:** v1.0.0 ships substantially matching the master-prompt intent across all ten phases. No RED findings. 14 active AMBERs are documented in `docs/KNOWN_ISSUES.md` for v1.1 triage; none block production operation.

**Recommended next actions (for project owner):**
1. Review AMBER-02 (brand colour) and AMBER-05 (triage vocabulary) and decide whether to align code or annotate docs.
2. Triage the Phase 6 AMBERs (08–13) against real operational experience — most are data-model richness decisions that can stay deferred if the current single-Appointment model meets vet-user needs.
3. Schedule AMBER-14 (in-memory idempotency → Redis/DB) if horizontal scaling is planned.
4. Tag `v1.0.0-audit-signed-off` on `main` once the above AMBERs are triaged and `docs/BUILD_PLAN.md` is updated with the audit reference.

**Audit signed by:** Claude Code (automated retrospective pass)
**Completion timestamp:** 2026-04-20
**Findings file SHA:** Will be captured in the sign-off commit.
