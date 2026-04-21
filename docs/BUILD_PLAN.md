# EquiSmile Build Plan

## Phase Overview

| Phase | Name | Branch | Status |
|-------|------|--------|--------|
| 0 | Scaffold | `feature/phase0-scaffold` | ✅ Complete |
| 1 | Foundation | `feature/phase1-foundation` | ✅ Complete |
| 2 | Core Features | `feature/phase2-core-features` | ✅ Complete |
| 3 | Messaging Intake | `feature/phase3-messaging-intake` | ✅ Complete |
| 4 | Triage Operations | `feature/phase4-triage-ops` | ✅ Complete |
| 5 | Route Planning | `feature/phase5-route-planning` | ✅ Complete |
| 6 | Booking & Confirmations | `feature/phase6-booking-confirmations` | ✅ Complete |
| 7 | Hardening & Polish | `feature/phase7-hardening-polish` | ✅ Complete |
| 8 | UAT & Launch | `feature/phase8-uat-launch` | ✅ Complete |

## Phase 0 — Scaffold

### Deliverables
- Tooling and configuration (package.json, tsconfig, Tailwind, ESLint, Prettier, Docker Compose)
- Documentation skeleton
- n8n workflow JSON skeletons (01–06)
- Prisma schema with complete data model
- Next.js App Router shell with bilingual i18n (EN/FR)
- Shared libraries and test scaffolding
- CLAUDE.md and .claude/ agent configuration
- GitHub Actions CI workflow

### Acceptance Criteria
- `npm run lint` passes ✅
- `npm run typecheck` passes ✅
- `npm run test` passes ✅
- `npx prisma validate` passes ✅
- `npm run build` passes ✅

## Phase 1 — Foundation

### Deliverables
- PWA shell with Serwist
- Docker Compose verified (PostgreSQL + n8n healthy)
- Prisma migration init
- Idempotent seed data
- Environment variable validation
- Health check API endpoint
- CI pipeline passing

## Phase 2 — Core Features

### Deliverables
- Customer/yard/horse CRUD with bilingual UI
- Manual enquiry creation
- Triage classification interface
- Planning pool view with filters
- Repository/service layer pattern

## Phase 3 — Messaging Intake

### Deliverables
- Meta WhatsApp Cloud API webhook handler
- Email/IMAP intake endpoint
- Message logging
- n8n-to-app REST contract
- Webhook signature verification

## Phase 4 — Triage Operations

### Deliverables
- Triage rules engine (EN/FR)
- Missing-information auto-detection
- Manual override and escalation with audit trail
- Triage task queue
- Status machine for valid transitions

## Phase 5 — Route Planning

### Deliverables
- Google Geocoding integration
- Geographic clustering by postcode area
- Route scoring algorithm
- Google Route Optimisation API integration
- Route proposal generation, review, approval

## Phase 6 — Booking & Confirmations

### Deliverables
- Route approval to appointment conversion
- WhatsApp/email confirmation dispatch (bilingual)
- 24h/2h reminder scheduling
- Cancel/reschedule handling
- Visit outcome recording with follow-up

## Phase 7 — Hardening & Polish

### Deliverables
- Retry logic with exponential backoff and jitter
- Structured JSON logging with data masking
- Error recovery UX (error boundaries, toast, offline banner)
- WCAG 2.1 AA accessibility
- PWA offline capabilities with request queue
- Performance (skeletons, pagination)
- Mobile polish (bottom sheet, safe-area insets)
- Pre-flight check script

## Phase 8 — UAT & Launch

### Deliverables
- Release candidate tag (`rc/v1.0.0`)
- CHANGELOG.md and release notes
- Comprehensive UAT test scripts (TC-001 through TC-008)
- Environment validation script
- Production readiness checklist
- Deployment guide with rollback procedure
- Enhanced seed data for realistic UAT testing
- Multi-stage production Dockerfile
- CI/CD enhancements (Docker build, security audit)
- Final documentation update

---

## Retrospective Audit (2026-04-20)

Following the release of `rc/v1.0.0`, a retrospective verification pass was run against every phase's master prompt.

- **Plan:** [PHASE_VERIFICATION_PLAN.md](./PHASE_VERIFICATION_PLAN.md)
- **Findings:** [V1_AUDIT_FINDINGS.md](./V1_AUDIT_FINDINGS.md)
- **AMBER items logged:** [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — 13 active AMBERs, 1 closed in-audit, 1 retracted, 1 resolved by PR #17

**Summary:** All 10 phases (0–9) verdict GREEN with AMBER log. Zero RED findings. Non-negotiable checks all pass (lint, typecheck, test, prisma validate, build). In-audit fix applied to `__tests__/unit/infra/demo-startup.test.ts` to guard Windows exec-bit assertions.

**State drift:** The audit was anchored at `fbafbd9`. During publication, PRs #13–#17 landed Phase 12 work on `main` (current HEAD `3e295ba`). AMBER-03 (seed counts) was resolved by PR #17's seed split; remaining AMBERs re-verified against the diff and stand.

Outstanding triage decisions for v1.1 include brand-colour reconciliation (AMBER-02), Phase 6 data-model richness (AMBER-08 through AMBER-13), and idempotency store externalisation (AMBER-14). See the findings file for the per-deliverable evidence tables.

---

## Phase 9 — Authentication (GitHub OAuth)

### Scope
- Gate the internal operations UI behind GitHub sign-in using Auth.js v5 with the `@auth/prisma-adapter`.
- Restrict access to an env-driven allow-list (`ALLOWED_GITHUB_LOGINS`), matching either GitHub login or email (case-insensitive).
- Add standard Auth.js Prisma models (`User`, `Account`, `Session`, `VerificationToken`) with a `role` column and `githubLogin` stored on `User` for future RBAC and audit wiring.
- Chain Auth.js middleware with the existing `next-intl` middleware; keep `/api/webhooks/*` (n8n) and `/api/auth/*` public.
- Replace the hard-coded `performedBy = "admin"` default in `app/api/triage-ops/override/route.ts` with the signed-in user's GitHub login/email.

### Deliverables
- `auth.ts`, `lib/auth/allowlist.ts`, `lib/auth/session.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/[locale]/login/page.tsx`, `components/auth/{SignInButton,UserMenu,AuthSessionProvider}.tsx`
- Prisma schema + migration for auth tables
- Updated `middleware.ts`, `lib/utils/env-check.ts`, `.env.example`
- Allow-list + middleware unit tests
- Docs: SETUP (GitHub OAuth App section), ARCHITECTURE (Authentication section), KNOWN_ISSUES (KI-006)

### Verification
- `npm run lint && npm run typecheck && npm run test` pass.
- `npx prisma validate` passes and a `prisma migrate dev` run creates the four auth tables.
- Unauthenticated visits to any locale route redirect to `/{locale}/login`.
- Allow-listed GitHub account signs in successfully; non-allow-listed account is denied with the `notAuthorised` banner.
- `/api/webhooks/whatsapp` still accepts n8n calls with `N8N_API_KEY` alone (no session).
- Triage override creates audit rows with `performedBy` set to the signed-in user, not `"admin"`.

---

## Phase 10 — Staff Model & Per-Vet Assignments

### Scope
- Support a 2+ vet practice by introducing a Staff model separate from the Auth User, so domain assignments are decoupled from auth plumbing.
- Track appointment ownership (primary vet + joint assignments) and route-run leadership (lead + assistants) so "rounds with both vets" is explicit, not convention.

### Deliverables
- Prisma: `Staff` model, `AppointmentAssignment` join, `RouteRunAssistant` join, `RouteRun.leadStaffId` FK. Additive migration only.
- Repository/service: `staff.repository.ts`, `staff.service.ts` (list/create/update/deactivate + assignToAppointment/assignToRouteRun + appointmentsForCalendar).
- API: `GET|POST /api/staff`, `GET|PATCH|DELETE /api/staff/[id]`, `POST|DELETE /api/staff/assign` (target=appointment|routeRun).
- UI: `/{locale}/staff` management page (list + create modal + toggle active).
- Validations: `lib/validations/staff.schema.ts` (zod).
- i18n: EN + FR strings for Staff page, roles, assignment labels.
- Seed: demo-staff-rachel (lead vet, maroon), demo-staff-second (visiting vet, blue), demo-staff-nurse (green).
- Tests: 10 service unit tests (create/duplicate email/assignment with primary flag/route-run lead+assistant/calendar filter).

### Verification
- `npm run lint`, `typecheck`, `test`, `prisma validate` all pass.
- `POST /api/staff { name }` creates a vet; duplicate email returns 409.
- `POST /api/staff/assign { target: 'appointment', appointmentId, staffId, primary: true }` unflags other primaries for that appointment.
- `POST /api/staff/assign { target: 'routeRun', routeRunId, staffId, isLead: true }` writes `RouteRun.leadStaffId`.

---

## Phase 11 — VetUp Dataset Export

### Scope
- Provide a clean CSV export of the EquiSmile dataset that can be ingested by VetUp (or any patient-centric PMS). Column schema is kept in `VETUP_PATIENT_COLUMNS` so it's a one-file change when the client confirms VetUp's actual headers.

### Deliverables
- `lib/services/csv.service.ts` — RFC 4180 encoder (CRLF, quote-escaping, null → empty, Date → ISO-8601).
- `lib/services/vetup-export.service.ts` — three profiles: `patient` (horse-centric with denormalised owner + yard), `customers`, `yards`.
- `GET /api/export/vetup?profile=patient|customers|yards` — streams CSV with `Content-Disposition: attachment`.
- Customers page gains three download buttons (VetUp, Customers, Yards).
- 13 unit tests (10 CSV encoder + 3 export service).

### Verification
- `curl /api/export/vetup?profile=patient` returns a CSV with the VetUp-patient header and one row per horse.
- Fields with commas or double quotes are correctly RFC-4180 quoted/escaped.
- Null fields render as empty (no literal "null" string).

---

## Phase 12 — Clinical Records

### Scope
- Per-horse clinical history: PDF/image attachments, dental charts, tooth-level findings, prescriptions. Sets up the data model that the Phase 13 vision pipeline will populate.

### Deliverables
- Prisma: `HorseAttachment`, `DentalChart`, `ClinicalFinding`, `Prescription` models + 4 new enums (AttachmentKind / FindingCategory / FindingSeverity / PrescriptionStatus). Additive migration.
- `lib/services/attachment.service.ts` — upload/list/read-bytes/delete; relative path kept in DB so storage backend (FS/S3) is swappable; 25 MB limit; allow-list of image+PDF mimes.
- `lib/services/clinical-record.service.ts` — CRUD for dental charts, findings, prescriptions; trims inputs, validates duration/withdrawal non-negative, mutates `status` + timestamp atoms on transitions.
- API: `GET|POST /api/horses/[id]/attachments`, `GET|DELETE /api/attachments/[id]`, `GET|POST /api/horses/[id]/clinical`, `PATCH /api/prescriptions/[id]`.
- `.env.example` adds `ATTACHMENT_STORAGE_DIR`; `.gitignore` excludes `data/attachments/`.

### Verification
- `curl -F file=@chart.pdf /api/horses/<id>/attachments` → row inserted, bytes on disk under `$ATTACHMENT_STORAGE_DIR/<horseId>/…`.
- `GET /api/attachments/<id>` streams the original bytes inline.
- `POST /api/horses/<id>/clinical { kind:'prescription', medicineName, dosage }` returns 201 ACTIVE row; `PATCH /api/prescriptions/<id> { status:'CANCELLED', cancelledReason }` sets status + cancelledAt.
- 16 unit tests (8 attachment, 8 clinical-record).

---

## Phase 13 — Vision Pipeline (Claude)

### Scope
- Analyse uploaded PDF dental charts and clinical images with Claude (Opus 4.7), producing structured findings + prescriptions that land directly in the Phase 12 clinical models. Acts as decision support — the vet reviews everything before acceptance.

### Deliverables
- `lib/integrations/anthropic.client.ts` — singleton SDK client; throws if `ANTHROPIC_API_KEY` unset; model override via `EQUISMILE_VISION_MODEL`.
- `lib/services/vision-analysis.service.ts` — builds vision message (document block for PDFs, image block for JPEG/PNG/WebP/GIF), calls Claude with adaptive thinking + `output_config.format: json_schema` using a strict Zod schema (generalNotes, findings[], prescriptions[], confidence). System prompt is cache-control marked. Validates response locally before persisting.
- Post-processing writes one `DentalChart` (linked to the source attachment) with all findings + any explicitly-recorded prescriptions, attributed to the calling staff member.
- API: `POST /api/attachments/[id]/analyse` — returns `{ dentalChartId, findingIds[], prescriptionIds[], result }`; returns 503 if `ANTHROPIC_API_KEY` is missing.
- `.env.example`: `ANTHROPIC_API_KEY` + optional `EQUISMILE_VISION_MODEL`.
- 14 unit tests (schema validation, extract/fallback/JSON error paths, service-level attachment lookup, persist=true vs false, PDF-vs-image block selection, staff attribution, cache_control placement).

### Verification
- `POST /api/attachments/<id>/analyse` with an equine dental PDF: returns 201 with findings[] and prescriptions[] populated; new DentalChart row linked via attachmentId.
- Without `ANTHROPIC_API_KEY`: 503 "Vision analysis unavailable".
- Corrupt/off-topic PDF: model returns `confidence: "low"`, empty findings, explanatory generalNotes — no findings/prescriptions written beyond the chart row.
- System prompt cached: `usage.cache_read_input_tokens > 0` on the second analyse call in a 5-minute window.

---

## Phase 13 — Postgres Idempotency Store (AMBER-14)

### Scope
- Replace the in-memory `processedKeys: Set<string>` in `lib/utils/retry.ts` with a Postgres-backed store so idempotency markers survive restarts and are shared across instances.

### Deliverables
- Prisma: `IdempotencyKey { key @id, scope, createdAt, expiresAt? }` with indexes on `scope` and `expiresAt`. Additive migration.
- `lib/services/idempotency.service.ts`: `hasProcessed(key)`, `markProcessed(key, scope, ttlMs?)` (upsert-based, concurrency-safe), `pruneExpired(now)`.
- `lib/utils/retry.ts`: `hasBeenProcessed` / `markAsProcessed` / `clearProcessedKeys` are now async and delegate to the service. Default TTL 30 days.
- Call sites (`lib/services/whatsapp.service.ts`) updated with `await`.
- `docs/KNOWN_ISSUES.md` AMBER-14 marked resolved.
- 8 new idempotency-service tests; existing `retry.test.ts` idempotency suite converted to async + uses an in-memory mock of the service.

### Verification
- Restart the app between two sends with the same idempotency key → second call still detects the dupe (was previously lost).
- `POST /api/health` shows the new table in `prisma migrate status`.
- Expired keys are pruned automatically on first `hasProcessed` read (self-healing).

---

## Phase 14 — Security Hardening (PR A: Auth + Headers)

### Scope
- Harden authentication and introduce defence-in-depth HTTP response headers.

### Deliverables
- `lib/auth/redirect.ts` — `isSafeCallbackUrl` / `safeCallbackUrl`. Rejects absolute URLs, protocol-relative URLs (`//evil`), percent-encoded variants, `javascript:`/`data:` schemes, path traversal, CR/LF/NUL injection, and oversize values. Wired into `middleware.ts`, `auth.ts` `redirect` callback, and `app/[locale]/login/page.tsx`.
- `lib/auth/allowlist.ts` — upgraded to constant-time comparison via `crypto.timingSafeEqual` (no short-circuit walk; length-gated).
- `auth.ts` — explicit secure cookie config (`__Secure-` / `__Host-` prefixes, `SameSite=Lax`, `HttpOnly`, `Secure` in production), 30-day session with 24-hour rotation, `trustHost` only when `AUTH_URL` is set, `useSecureCookies` in prod, `redirect` callback that enforces same-origin.
- `lib/security/headers.ts` + middleware wiring — adds:
  - `Content-Security-Policy` (pragmatic for HTML; strict `default-src 'none'; frame-ancestors 'none'` for API)
  - `Strict-Transport-Security` (production only)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (disables camera/mic/etc.)
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
- Tests: 12 redirect tests + 8 header tests + 5 new allowlist tests + 2 new middleware tests.

### Verification
- `npm run lint`, `typecheck`, `test`, `prisma validate` all pass (674 tests across 73 files).
- Open-redirect vectors (`//evil`, `%2F%2Fevil`, `/javascript:...`, `/../admin`, CR/LF injection) are rejected by both the middleware callbackUrl attach step and the Auth.js `redirect` callback.
- Non-allow-listed sign-in attempts are logged without identifiers; production cookies carry `__Secure-` prefix.

---

## Phase 14 — Security Hardening (PR B: RBAC + Audit Log)

### Scope
- Enforce least-privilege on sensitive API routes and record every security-relevant action in an append-only audit log.

### Deliverables
- `lib/auth/rbac.ts` — `ROLES` enum (`admin | vet | nurse | readonly`) + `normaliseRole` + `hasRole` + `requireAuth` + `requireRole` + `withRole` + `AuthzError`. Unknown roles default to `readonly` (deny-by-default).
- Prisma: `SecurityAuditLog` + `SecurityAuditEvent` enum with 17 event types. Additive migration `20260420130000_phase14_security_audit`.
- `lib/services/security-audit.service.ts`: `record(event, actor, ...)` (best-effort, never blocks the primary request), `recent({limit, event})` for admin dashboards; detail is truncated to 500 chars; no secrets.
- Route lockdowns (with audit where appropriate):
  - `GET/POST /api/export/vetup` → **ADMIN** + `EXPORT_DATASET` audit
  - `POST /api/staff` → **ADMIN** + `STAFF_CREATED`
  - `PATCH /api/staff/[id]` → **ADMIN** + `ROLE_CHANGED` | `STAFF_UPDATED`
  - `DELETE /api/staff/[id]` → **ADMIN** + `STAFF_DEACTIVATED`
  - `GET /api/staff` + `GET /api/staff/[id]` → **READONLY**
  - `POST/DELETE /api/staff/assign` → **VET**
  - `GET /api/attachments/[id]` → **NURSE** + `ATTACHMENT_DOWNLOADED`
  - `DELETE /api/attachments/[id]` → **VET** + `ATTACHMENT_DELETED`
  - `POST /api/attachments/[id]/analyse` → **VET** + `VISION_ANALYSIS_INVOKED`
  - `GET /api/horses/[id]/attachments` → **NURSE**
  - `POST /api/horses/[id]/attachments` → **VET** (uploader attribution taken from session, not form)
  - `GET /api/horses/[id]/clinical` → **NURSE**
  - `POST /api/horses/[id]/clinical` (dentalChart/finding/prescription) → **VET** + `CLINICAL_RECORD_CREATED`
  - `PATCH /api/prescriptions/[id]` → **VET** + `PRESCRIPTION_STATUS_CHANGED`
  - `GET /api/status` → **ADMIN**
- `auth.ts` sign-in denial callback writes `SIGN_IN_DENIED` audit events with a coarse actor label (no denied-user identifiers stored).
- `/api/setup` lint warning cleaned up as a drive-by.
- Tests: 15 RBAC tests + 10 audit-service tests. Net 695 passing across 75 files.

### Verification
- A `nurse` cannot `POST /api/horses/<id>/clinical` or `DELETE /api/attachments/<id>` (403).
- A `readonly` cannot `POST /api/staff` (403) but can `GET /api/customers`.
- A `vet` cannot `GET /api/export/vetup` (admin-only).
- Every admin export, attachment delete/download, clinical mutation, prescription status change, and vision-analysis invocation lands in `SecurityAuditLog`.

---

## Phase 14 — Security Hardening (PR C: Webhook HMAC + Rate limiting + Log redaction)

### Scope
- Harden public-path webhook auth, cap abuse-prone routes with a rate limiter, and introduce a log-redaction utility so secrets can't leak via structured logs.

### Deliverables
- `lib/utils/signature.ts` — new `constantTimeStringEquals` helper; new `verifyWhatsAppVerifyToken` that uses it so the GET-challenge verify token can't be probed by timing.
- `app/api/webhooks/whatsapp/route.ts` — `GET` swaps `===` for constant-time compare; `POST` rate-limited per client IP (300/min) before parsing body.
- `app/api/webhooks/email/route.ts` — `POST` rate-limited per client IP (200/min) before signature check.
- `lib/utils/rate-limit.ts` — in-memory sliding-window limiter, `rateLimiter({windowMs, max, now, maxKeys})` + `rateLimitedResponse` helper + `clientKeyFromRequest`. Per-key LRU-bounded to 10,000 keys.
- Wired into: `POST /api/attachments/[id]/analyse` (20/hour per user — caps Claude Opus 4.7 spend) and `GET /api/export/vetup` (10/hour per admin — discourages automated exfil).
- `lib/utils/log-redact.ts` — `redact(value)` walks any object, replaces values of sensitive keys (authorization, api_key, cookie, password, signature, etc.) with `[redacted]`; also redacts `Bearer …` and `sk-…` string values regardless of key.
- Tests: 11 rate-limit + 10 log-redact + 6 new signature tests. Net 722 passing across 77 files.

### Verification
- Spamming `POST /api/webhooks/whatsapp` 301 times in a minute from one IP returns 429 with `Retry-After`.
- `GET /api/export/vetup?profile=patient` 11 times from the same admin returns 429.
- `redact({authorization: 'Bearer sk-xxx'})` returns `{authorization: '[redacted]'}`.
- WhatsApp GET verification with a same-length wrong token no longer short-circuits compared to a matching token (no timing oracle).

### Limits / follow-ups
- The rate limiter is in-memory per Node instance. Horizontal scaling needs a Redis (or Postgres — same pattern as `IdempotencyKey`) backend.
- The `log-redact` utility is available but not yet automatically wired into every `console.log`; adopt on a per-call basis as call sites are reviewed.

---

## Phase 14 — Security Hardening (PR D: AMBER gap closure)

### Scope
- Resolve the functional gaps logged during the v1.0.0 retrospective audit. Split across three data-model additions, three audit-service wirings, a dead-letter queue, a visit-requests operator page, and docs reconciliation for the items that were naming/narrative gaps rather than code gaps.

### Deliverables
- Prisma additive migration `20260420140000_phase14_amber_gap_closure`:
  - AMBER-06: `Yard` gets nullable `geocodeSource`, `geocodePrecision`, `formattedAddress`.
  - AMBER-10: `ConfirmationDispatch { appointmentId, channel, sentAt, success, externalMessageId?, errorMessage? }`.
  - AMBER-11: `AppointmentResponse { appointmentId, kind, channel, receivedAt, rawText?, enquiryMessageId? }` + `AppointmentResponseKind` enum.
  - AMBER-13: `AppointmentStatusHistory { appointmentId, fromStatus?, toStatus, changedBy, reason?, changedAt }`.
  - AMBER-15: `FailedOperation { scope, operationKey?, payload, lastError, attempts, status, createdAt, updatedAt }` + `FailedOperationStatus` enum.
- `lib/services/appointment-audit.service.ts`: `logConfirmationDispatch`, `logResponse`, `logStatusChange` (skips no-op transitions), plus readers. Best-effort writes.
- `lib/services/dead-letter.service.ts`: `enqueue` (runs `redact()` + caps sizes), `list({status,scope,limit})`, `markStatus`.
- Wirings:
  - `confirmationService.sendConfirmation` writes a `ConfirmationDispatch` row on every attempt (success or failure).
  - `bookingService.bookRoute`, `rescheduleService.cancelAppointment` / `markNoShow`, `visitOutcomeService.completeVisit` each write `AppointmentStatusHistory` rows in the same transaction as the status mutation.
  - `whatsappService.sendTextMessage` / `sendTemplateMessage` and `emailService.sendEmail` enqueue `FailedOperation` rows on permanent failure.
- `app/[locale]/visit-requests/page.tsx` (AMBER-04) — list view with planning-status + urgency filters; sidebar entry + EN/FR i18n.
- Docs: `docs/ARCHITECTURE.md` new "Domain vocabulary reconciliation" section (AMBER-05, 07, 08, 12) with explicit mapping tables; `docs/KNOWN_ISSUES.md` updated — 10 AMBERs closed.
- `eslint.config.mjs`: `argsIgnorePattern: ^_` so `_text`-style deliberately-unused args stop tripping the linter.
- Tests: 6 appointment-audit + 7 dead-letter = 13 new tests. Net (pre-PR D baseline 722) → see running-totals below.

### AMBERs closed in PR D
- AMBER-04 (code) — `/visit-requests` route + UI
- AMBER-05 (docs) — triage vocabulary reconciliation
- AMBER-06 (code) — geocoding metadata
- AMBER-07 (docs) — RouteRun naming rationale
- AMBER-08 (docs) — AppointmentStatus rationale
- AMBER-10 (code) — `ConfirmationDispatch`
- AMBER-11 (code) — `AppointmentResponse`
- AMBER-12 (docs) — `ReminderSchedule` rationale
- AMBER-13 (code) — `AppointmentStatusHistory`
- AMBER-15 (code) — `FailedOperation` DLQ

### Verification
- `SELECT event, actor, targetType FROM "SecurityAuditLog"` after a full booking → cancellation cycle shows the expected trail of events AND `AppointmentStatusHistory` shows `null → PROPOSED → CANCELLED`.
- Forcing a WhatsApp send against an invalid phone number enqueues a `FailedOperation` row whose `payload` contains `[redacted]` for any Bearer/api_key value that may have been attempted.
- `/en/visit-requests` loads at 390px width; filters refine the returned list.
- Only documentation-only AMBERs remain open: AMBER-09 (`AppointmentHorse` link table) — deferred per the audit note (adequate until per-appointment horse metadata is tracked).

---

## Phase 14.1 — Truthfulness pass

### Scope
- Verify the overnight hardening report claims against the repo, fix any mismatches with the smallest safe change, and lock the fix in with a regression test.

### Findings & fixes
- **Uploader attribution spoofing** (high-severity) — `app/api/horses/[id]/attachments` POST previously fell back to `uploadedById` read from the multipart form if present, and used `subject.id` (Auth.js `User.id`) as a second fallback. Two bugs:
  1. Authenticated vet could spoof a colleague as the uploader by adding `uploadedById=<victim-staff-id>` to the form.
  2. `HorseAttachment.uploadedById` FK references `Staff.id`, so the fallback would also fail the FK check (or silently mis-attribute) when `subject.id` is a bare User id.

  **Fix**: ignore the form field entirely; resolve `staffRepository.findByUserId(subject.id)` and store `staff?.id ?? null`. New regression suite `__tests__/unit/api/horses-attachments.test.ts` locks in four cases: session→staff happy path, spoofed form value dropped, no-linked-staff falls back to null, description passes through unchanged.

### Other claims re-verified (no code change needed)
- Every `Appointment.status` mutation site (`bookingService`, `rescheduleService.cancel`/`markNoShow`, `visitOutcomeService`) now writes `AppointmentStatusHistory`; no stray mutation site exists.
- Every `requireRole` placement matches the overnight report (`/api/export/vetup` ADMIN, `/api/staff` mutations ADMIN, `/api/attachments/[id]` NURSE GET + VET DELETE, `/api/attachments/[id]/analyse` VET, `/api/horses/[id]/clinical` NURSE GET + VET POST, `/api/horses/[id]/attachments` NURSE GET + VET POST, `/api/prescriptions/[id]` VET, `/api/status` ADMIN).
- Rate limits wired at the four claimed routes (`webhooks/whatsapp`, `webhooks/email`, `export/vetup`, `attachments/[id]/analyse`).
- `deadLetterService.enqueue` called from three claimed sites (`whatsapp sendTextMessage`, `whatsapp sendTemplateMessage`, `email sendEmail`).
- `applySecurityHeaders` wraps every branch of `middleware.ts` (6 call sites).
- `verifyWhatsAppVerifyToken` is the only verify-token check in `app/api/webhooks/whatsapp/route.ts` (no residual `===`).

### Verification
- `npm run lint`, `typecheck`, `test`, `prisma validate`, `build` — all green. Net 739 tests passing (+4 new).

---

## Phase 14 — Security Hardening (PR E: overnight gap-closure pass)

### Scope
Overnight hardening sweep focused on data-access RBAC, fail-closed webhook auth, and rate limiting. Priority: protect customer/clinical data and close the remaining unauthenticated-integration paths.

### Deliverables
- **Fail-closed n8n / webhook auth** — `lib/utils/signature.ts#requireN8nApiKey` replaces ad-hoc `if (env.N8N_API_KEY)` checks. Returns HTTP 500 in production when the key is unset, instead of silently accepting anonymous traffic. Applied to:
  - `/api/webhooks/email`
  - `/api/n8n/triage-result`, `/api/n8n/geocode-result`, `/api/n8n/route-proposal`
  - `/api/n8n/trigger/send-email`, `/api/n8n/trigger/send-whatsapp`, `/api/n8n/trigger/request-info`
  - `/api/reminders/check`
- **Middleware public-paths** — `/api/n8n/*` and `/api/reminders/check` added so n8n server-to-server calls are not blocked by the session middleware while the fail-closed API-key gate runs in the handler.
- **Per-route rate limits** on every n8n-authenticated endpoint (60–300 req/min per IP) plus a 30 req/min per-IP limiter on `/api/auth/{callback,signin,verify-request,session}` in `middleware.ts` to slow magic-link / OAuth callback abuse.
- **RBAC + audit** — `requireRole` added to customer / horse / yard / enquiry / visit-request / appointment / dashboard / triage-ops / triage-tasks / route-planning endpoints. DELETEs on Customer / Yard / Horse now write `SecurityAuditLog` entries (`CUSTOMER_DELETED`, `YARD_DELETED`, `HORSE_DELETED`). Override endpoint now derives `performedBy` from the RBAC subject, closing a spoofable-actor gap.
- **Geocoding provenance runtime coverage** — both `geocodingService.geocodeYard` and `updateYardCoordinates` now write `geocodeSource` / `geocodePrecision` / `formattedAddress` (columns existed from PR D but weren't populated on the Google path).
- **Tests** — signature-gate tests (6 new cases), middleware public-path tests (3 new cases), customer delete RBAC + audit tests (2 new cases). All existing suites adapted.

### Verification
- `npm run lint`, `typecheck`, `test`, `prisma validate`, `build` — all green. Net 749 tests passing (+10 net new).
- Manual: confirmed unauthenticated `GET /api/n8n/triage-result` now returns 500 in a non-demo env with `N8N_API_KEY` unset; returns 401 with it set and no Bearer header; returns 200 with correct Bearer.
- Manual: DELETE /api/customers/:id with a NURSE session now returns 403; with ADMIN returns 200 and writes a `CUSTOMER_DELETED` row.
