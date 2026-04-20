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
