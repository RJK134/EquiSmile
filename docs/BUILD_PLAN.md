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
