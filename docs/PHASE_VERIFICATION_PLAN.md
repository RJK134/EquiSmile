# EquiSmile v1.0.0 — Phase Verification Plan

## Purpose

EquiSmile v1.0.0 shipped on 2026-04-15 and all ten delivery phases (0–9) are marked complete in `docs/BUILD_PLAN.md`. This plan defines a **retrospective verification pass** against each phase's master prompt to confirm the acceptance criteria are genuinely met by the current code on `main`, to file any real gaps, and to remediate them using a disciplined commit → PR → Copilot → Bugbot → Claude-review → merge cycle.

**Non-goals:**
- No new feature work. No scope expansion.
- No refactor for aesthetics. Only evidence-backed gaps are in scope.
- No rewrite. Existing code stays unless a criterion genuinely fails.

**Goal:** every master-prompt deliverable is either GREEN (verified in current code), AMBER (non-blocking issue filed against `docs/KNOWN_ISSUES.md`), or remediated via a tracked PR.

## Status snapshot

| Phase | Merged PR | Master prompt | Branch used |
|---|---|---|---|
| 0 Scaffold | #1 `f0b141e` | n/a (scaffold) | `feature/phase0-scaffold` |
| 1 Foundation | #2 `eabb4af` | `PHASE_1_MASTER_PROMPT.md` | `feature/phase1-foundation` |
| 2 Core Features | #3 `a508142` | `PHASE_2_MASTER_PROMPT.md` | `feature/phase2-core-features` |
| 3 Messaging Intake | #4 `8b016f5` | `PHASE_3_MASTER_PROMPT.md` | `feature/phase3-messaging-intake` |
| 4 Triage Operations | #5 `a0a07ff` | `PHASE_4_MASTER_PROMPT.md` | `feature/phase4-triage-ops` |
| 5 Route Planning | #6 `fbfa13b` | `PHASE_5_MASTER_PROMPT.md` | `feature/phase5-route-planning` |
| 6 Booking & Confirmations | #7 `4c569c0` | `PHASE_6_MASTER_PROMPT.md` + `PHASE_6_DATA_MODEL.md` | `feature/phase6-booking-confirmations` |
| 7 Hardening & Polish | #8 `ed27131` | `PHASE_7_MASTER_PROMPT.md` | `feature/phase7-hardening-polish` |
| 8 UAT & Launch | #9 `c76e9d0` | (no master prompt; BUILD_PLAN.md) | `feature/phase8-uat-launch` |
| 9 Production Readiness | #10 `d122d08` | (no master prompt) | `feature/phase9-production-readiness` |

Release tag: `rc/v1.0.0`. Current HEAD: `fbafbd9` (all post-release changes are triage/dashboard/demo bug fixes).

---

## Audit methodology

### Evidence standards

Every acceptance-criterion decision must be backed by one of:

| Evidence type | Example | Required for |
|---|---|---|
| **Command output** | `npm run typecheck` exits 0 | Build/test/validate gates |
| **File reference** | `app/api/health/route.ts:12-34` returns the documented JSON shape | API contracts, handlers |
| **Test reference** | `__tests__/triage/rules.test.ts` covers EN + FR inputs | Unit/integration requirements |
| **UI inspection** | Screenshot at 390px showing bottom-anchored nav | Mobile/layout/a11y gates |
| **DB inspection** | Prisma model has indexed unique key on `dedupe_key` | Schema/dedupe/idempotency gates |

"I think it's there" is not evidence. If the audit cannot produce one of the above, the criterion is AMBER pending verification or RED if verification finds a defect.

### Severity and status

Each numbered deliverable in the master prompt (e.g., "1.1", "1.2" …) gets one of:

- **GREEN** — criterion verified; evidence captured.
- **AMBER** — criterion partially met; non-blocking gap documented in `docs/KNOWN_ISSUES.md`.
- **RED** — criterion fails verification; must be remediated before the phase is signed off.

### Per-phase audit procedure

For each phase in order (0 → 9):

1. **Read** the master prompt (`PHASE_N_MASTER_PROMPT.md` in the repo root one level up: `D:/Projects/Equismile/`).
2. **Extract** every numbered deliverable (the X.1, X.2, X.3 … sub-sections).
3. **Verify** each deliverable in the current `main` code using the evidence standards above.
4. **Record** findings in `docs/V1_AUDIT_FINDINGS.md` (see "Output locations" below) under a phase heading — one row per deliverable with Status / Evidence / Notes columns.
5. **Classify** gaps: file AMBER items in `docs/KNOWN_ISSUES.md` with severity and workaround; file RED items as GitHub issues tagged `audit-gap` and `phase-N`.
6. **Sign-off** the phase when every deliverable is GREEN or has an AMBER log entry or a tracked RED issue.

### Audit tools and commands

Run once at the start of the audit to baseline the environment:

```bash
cd D:/Projects/Equismile/equismile
npm ci
npx prisma generate
npx prisma validate
npm run lint
npm run typecheck
npm run test
npm run build
```

Capture outputs into `docs/V1_AUDIT_FINDINGS.md` under a "Baseline" heading. Any failure here is immediately RED and blocks the audit from proceeding until fixed.

---

## Per-phase verification checklists

Each section below lists what to verify. The master prompt remains the authoritative source — these are pointers, not replacements.

### Phase 0 — Scaffold

Scope is implicit (no master prompt). Verify against `docs/BUILD_PLAN.md` § Phase 0 deliverables:

- Tooling: `package.json`, `tsconfig.json`, `tailwind.config.*`, ESLint, Prettier, `docker-compose.yml`, `vitest.config.ts`
- Docs skeleton in `docs/` (ARCHITECTURE, BUILD_PLAN, TEST_STRATEGY, PR_REVIEW_CHECKLIST, KNOWN_ISSUES, SETUP)
- `n8n/01-inbound-whatsapp.json` through `n8n/06-approval-and-confirmations.json` present
- `prisma/schema.prisma` with core data model
- `app/` App Router shell with `[locale]` segment and `next-intl` wired up
- CI workflow at `.github/workflows/*.yml`
- `CLAUDE.md` and `.claude/` agent config

**Acceptance**: all five non-negotiable checks pass (lint, typecheck, test, prisma validate, build).

### Phase 1 — Foundation

Source: `PHASE_1_MASTER_PROMPT.md`. Deliverables 1.1–1.9:

- **1.1** Next.js App Router clean compile — `npm run build` zero errors
- **1.2** PWA shell — `app/manifest.ts`, `app/sw.ts`, 44px touch targets, `#9b214d` brand colour, bottom nav ≤768px
- **1.3** Docker Compose — `docker compose up -d postgres n8n` healthy; SETUP.md documents startup
- **1.4** Prisma baseline — `prisma/migrations/` has `init` migration; `prisma validate` passes
- **1.5** Seed idempotent — `npm run db:seed` twice in a row succeeds; produces ≥1 customer, ≥1 yard with UK postcode, ≥1 routine + ≥1 urgent visit request
- **1.6** Env validation — `lib/env.ts` throws named errors for missing vars; `.env.example` complete
- **1.7** Health check — `/api/health` returns `db`, `env`, `n8n` statuses
- **1.8** CI — lint + typecheck + test + validate + build all green on latest main
- **1.9** Mobile QA — 390/375/414/768/1280px widths; no horizontal overflow; nav visible; 44px targets

### Phase 2 — Core Features

Source: `PHASE_2_MASTER_PROMPT.md`. Extract every numbered deliverable from the prompt and verify against:

- Prisma entities: Customer, Yard, Horse, Enquiry, VisitRequest, TriageDecision (inspect `prisma/schema.prisma`)
- Seed realism: 8 customers, 6 yards, 20 horses, 12 enquiries, 10 visit requests — check `prisma/seed.ts`
- Pages present under `app/[locale]/`: `/dashboard`, `/enquiries`, `/visit-requests`, `/customers`, `/yards`, `/horses`, `/triage`, `/planning`
- Dashboard counts: urgent, routine, planning, missing-info (visit the page or read the component)
- Manual enquiry form validation (zod or equivalent)
- Triage rules engine — `lib/triage/*.ts` with EN + FR keyword coverage
- Planning pool grouping by postcode/area
- Repository/service pattern — no raw Prisma calls in route handlers
- Unit + integration tests covering the above

### Phase 3 — Messaging Intake

Source: `PHASE_3_MASTER_PROMPT.md`. Verify:

- Inbound message domain contract documented in `docs/N8N_CONTRACT.md`
- `MessageLog` Prisma model with `provider`, `thread_key`, `dedupe_key`, status, raw payload
- Meta WhatsApp webhook: GET verification (`hub.challenge`) and POST ingestion — `app/api/webhooks/whatsapp/route.ts` (or equivalent path)
- Signature verification (`X-Hub-Signature-256`) implemented and unit-tested
- Email/IMAP intake path — either in-app endpoint or n8n Email Trigger with documented contract
- Shared pipeline: validate → dedupe → create log → resolve customer → resolve enquiry
- Dedupe key strategy documented and tested (duplicate message ID does not create second enquiry)
- Customer/enquiry matching by phone/email is conservative (tested edge cases)
- Message log visibility on customer and enquiry detail pages
- Tests: webhook verification, payload parsing, dedupe, matching

### Phase 4 — Triage Operations

Source: `PHASE_4_MASTER_PROMPT.md`. Verify:

- Triage decision model dispositions match: `urgent_review`, `same_week_priority`, `ready_for_planning`, `missing_information`, `admin_only`, `no_action`, `closed_duplicate`
- Triage review queue page exists and filters correctly
- Missing-information loop: categories, follow-up request creation, resolution tracking
- Manual override flow: reason captured, suggested vs final value preserved in audit trail
- Escalation flow: trigger reason, target, SLA, status, notes
- Operational status machine: `new → under_review → missing_information → ready_for_planning → escalated → planning_pool → on_hold → closed`
- Invalid transitions rejected by a central service (tested)
- Timeline/audit log visible on each record
- Dashboard refinements: urgent awaiting review, escalations pending, ageing items
- Tests: disposition logic, transitions, loops, overrides, escalations

### Phase 5 — Route Planning

Source: `PHASE_5_MASTER_PROMPT.md`. Verify:

- Geocoding model fields: lat/long, source, status, formatted address, postcode, precision, timestamp
- Geocoding pipeline handles success / partial / failure + retry + de-duplication
- Planning eligibility rules enforced (status + disposition + address quality + geocode success + no hold)
- Clustering logic by postcode/distance/priority
- Route scoring inputs: yards, horses, travel time, service time, compactness, priority, workload balance, distance
- `RouteProposal`, `RouteStop` entities with status/score/duration/cluster/generated-at
- Google Route Optimization integration — payload builder + parser isolated/testable
- Vehicle/day settings: home location, start/end times, service duration, max visits
- Route proposal review UI: list, score, ordered stops, summaries, approve/reject
- Spatial review aid present (map or coordinate list)
- n8n orchestration hooks documented
- Error resilience — failures don't crash the app
- Tests: eligibility, clustering, scoring, payload builder, response parsing, proposal persistence

### Phase 6 — Booking & Confirmations

Sources: `PHASE_6_MASTER_PROMPT.md` + `PHASE_6_DATA_MODEL.md` + `PHASE_6_SCHEMA_PATCH.prisma`. Verify:

- Appointment model with `bookingStatus`, `confirmationStatus`, `reminderStatus`, scheduled date/window, duration, linked entities
- `AppointmentHorse`, `ConfirmationDispatch`, `AppointmentResponse`, `ReminderSchedule`, `AppointmentStatusHistory` present if data model doc specifies them
- Unique/index constraints per the schema patch
- Only approved route proposals → appointments; duplicate prevention; actor/time recorded
- Booking review UI exists and blocks incomplete bookings
- Bilingual confirmation templates (EN/FR) for WhatsApp + email
- Dispatch workflow prevents duplicate sends
- Response handling: confirmed / cannot attend / reschedule / cancelled mapped correctly
- Cancel/reschedule flows return work to planning queue
- Reminder workflow: configurable timing, avoids cancelled/duplicates
- Status sync: booked → visit-request status update; confirmed → daily ops; cancelled → removed from active plan
- Audit trail covers create, send, respond, remind, cancel, reschedule, move, complete
- Tests cover all above transitions

### Phase 7 — Hardening & Polish

Source: `PHASE_7_MASTER_PROMPT.md`. Verify:

- Retry + failure hardening for WhatsApp, email, confirmations, reminders, geocoding, optimization, n8n
- Exponential backoff with jitter (look for a shared retry util and its tests)
- Idempotency keys honoured across retries
- Dead-letter or quarantine path for permanent failures
- Structured JSON logs with correlation IDs and sensitive-data masking
- Error boundaries + user-facing retry UX + "needs attention" states
- Accessibility: semantic HTML, keyboard nav, focus states, labels, contrast, 44px targets, screen-reader announcements
- Performance: bundle analysis evidence, lazy loading, skeletons, pagination, list simplification
- Mobile polish: spacing, sticky nav, sheet behaviour, safe-area insets, scroll/overflow
- Prisma migrations committed, `prisma migrate deploy` used in production path
- Queue resiliency: stalled-item detection, safe retries, status history, ageing visibility
- Tests on retry logic, error handling, a11y components
- Documentation: retry strategy, idempotency, logging design, a11y checklist, performance priorities, deployment safety

### Phase 8 — UAT & Launch

No master prompt; source is `docs/BUILD_PLAN.md` § Phase 8 and `docs/uat/`. Verify:

- `rc/v1.0.0` tag exists and points to the intended commit
- `CHANGELOG.md` present and accurate
- `docs/RELEASE_NOTES_v1.0.0.md` present
- UAT test cases TC-001…TC-008 documented in `docs/uat/` with pass/fail outcomes
- `scripts/validate-environment.ts` present and runs
- `docs/PRODUCTION_READINESS.md` complete
- `docs/DEPLOYMENT.md` includes rollback
- Enhanced seed used for UAT (`prisma/seed-demo.ts`)
- Multi-stage `Dockerfile` present
- CI includes Docker build + security audit steps

### Phase 9 — Production Readiness (post-v1.0)

No master prompt. Source: PR #10 `d122d08` description. Verify:

- Demo mode toggle (feature-flagged)
- Integration layer abstractions (swap mock ↔ real providers)
- Docker stack runs end-to-end on a clean machine (`DEMO.bat` / `docker-compose up`)
- `README.md` demo quick-start accurate
- Bug-fix commits after #10 do not regress phase-9 scope (spot-check triage, dashboard, demo seed)

---

## Remediation workflow

For every RED finding and any AMBER finding the user wants fixed rather than logged:

1. **Branch** — `fix/audit-phaseN-<slug>` from `main`. One branch per coherent gap cluster; do not mix phases.
2. **Commit** — small, reviewable commits following the project convention (`fix(phaseN): …`, `chore(phaseN): …`).
3. **Local gates** — the five non-negotiable checks must pass locally before push:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npx prisma validate`
   - `npm run build`
4. **Push and open PR** as a draft. Title: `fix(phaseN): <concise gap summary>`. Body must include:
   - Link to audit finding in `docs/V1_AUDIT_FINDINGS.md`
   - Master-prompt deliverable(s) addressed (e.g., "4.3")
   - Verification evidence (command output, test added, screenshot)
   - Risk assessment + rollback
5. **Review cycle**:
   - **GitHub Copilot review** requested on the PR.
   - **Cursor/Bugbot scan** run against the PR diff.
   - **Claude Code review** — read both bot reports, address only valid findings, reject out-of-scope suggestions with a comment explaining why.
   - **Human ack** from the project owner before merge.
6. **Merge** — squash merge only (see `CLAUDE.md` § Git workflow). Delete the branch.
7. **Update** `docs/V1_AUDIT_FINDINGS.md` to mark the finding CLOSED with the merged PR number.

A finding is not closed until the corresponding row in the audit findings table is updated with evidence of the merged remediation.

### Amber-only path

For an AMBER that the user accepts as-is:

1. Add an entry to `docs/KNOWN_ISSUES.md` with: phase, deliverable, severity, description, workaround, owner, target date.
2. Mark the finding as AMBER-LOGGED in `docs/V1_AUDIT_FINDINGS.md` with a link to the KNOWN_ISSUES entry.
3. No PR required.

---

## Output locations

| File | Purpose | Created by this plan |
|---|---|---|
| `docs/V1_AUDIT_FINDINGS.md` | Per-phase findings table (Status/Evidence/Notes) | **Yes** — create when audit begins |
| `docs/KNOWN_ISSUES.md` | Amber-logged items from the audit (append) | Existing — append only |
| GitHub issues tagged `audit-gap` + `phase-N` | Tracking RED findings during remediation | Per finding |
| `docs/PHASE_VERIFICATION_PLAN.md` | This plan | Present |

The audit findings file is the authoritative record. When the audit is complete it gets a "Sign-off" section summarising totals per phase and per status.

---

## Execution schedule

Recommended batch size: **one phase per working session**. This keeps context tight for the PR cycle and matches one branch-per-phase.

Suggested order:

1. **Session 1** — Baseline commands + Phase 0 + Phase 1 audit (simplest, fastest).
2. **Session 2** — Phase 2 (largest by file count).
3. **Session 3** — Phase 3 (messaging contracts require careful payload review).
4. **Session 4** — Phase 4 (state machine + triage logic).
5. **Session 5** — Phase 5 (route planning + external Google Maps contracts).
6. **Session 6** — Phase 6 (booking + data model patch verification).
7. **Session 7** — Phase 7 (hardening, a11y, perf — mostly qualitative).
8. **Session 8** — Phases 8 + 9 (launch readiness + post-launch demo mode).
9. **Session 9** — Remediation rollup: open fix/* PRs for any RED items in priority order.
10. **Sign-off session** — finalise `docs/V1_AUDIT_FINDINGS.md`, update `docs/BUILD_PLAN.md` with a "Retrospective audit complete" note, tag `v1.0.0-audit-signed-off`.

Stop conditions (per `CLAUDE.md`):

- If a finding would require a breaking architectural change → stop, report, ask.
- If a third-party integration (Meta, Google Maps, n8n) blocks verification → stop, report, ask.
- If remediation would widen scope beyond the phase under audit → stop, record the finding, do not fix in this audit.

---

## Sign-off criteria

The audit is complete when all of the following are true:

- [ ] Every phase (0–9) has a populated section in `docs/V1_AUDIT_FINDINGS.md` with Status/Evidence/Notes for every numbered deliverable.
- [ ] Every RED finding has either (a) a merged remediation PR referenced in the findings file, or (b) an explicit "accepted, deferred to vN.M" annotation signed off by the project owner.
- [ ] Every AMBER finding is either closed via remediation or logged in `docs/KNOWN_ISSUES.md`.
- [ ] All five non-negotiable checks pass on `main` after remediation merges.
- [ ] `docs/BUILD_PLAN.md` has a "Retrospective audit" section with date, summary totals, and link to findings.
- [ ] Project owner's explicit sign-off recorded in `docs/V1_AUDIT_FINDINGS.md`.

At that point the tag `v1.0.0-audit-signed-off` is pushed against the latest `main` and this plan is considered executed.
