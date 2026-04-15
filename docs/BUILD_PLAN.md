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
