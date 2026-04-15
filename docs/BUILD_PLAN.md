# EquiSmile Build Plan

## Phase Overview

| Phase | Name | Branch | Status |
|-------|------|--------|--------|
| 0 | Scaffold | `feature/phase0-scaffold` | In Progress |
| 1 | Foundation | `feature/phase1-foundation` | Planned |
| 2 | Core Features | `feature/phase2-core-features` | Planned |
| 3 | Messaging Intake | `feature/phase3-messaging-intake` | Planned |
| 4 | Triage Operations | `feature/phase4-triage-ops` | Planned |
| 5 | Route Planning | `feature/phase5-route-planning` | Planned |
| 6 | Booking & Confirmations | `feature/phase6-booking-confirmations` | Planned |
| 7 | Hardening & Polish | `feature/phase7-hardening-polish` | Planned |
| 8 | UAT & Launch | `feature/phase8-uat-launch` | Planned |

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
- `npm run lint` passes
- `npm run typecheck` passes
- `npm run test` passes
- `npx prisma validate` passes
- `npm run build` passes
- Mobile navigation visible at 390px width
- Desktop sidebar visible at 1280px width
- Language switcher toggles between EN and FR

## Phase 1 — Foundation

### Deliverables
- PWA shell with next-pwa
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
- Triage rules engine
- Missing-information auto-detection
- Manual override and escalation
- Triage task queue

## Phase 5 — Route Planning

### Deliverables
- Google Geocoding integration
- Geographic clustering
- Route scoring algorithm
- Google Route Optimisation API integration
- Route proposal generation

## Phase 6 — Booking & Confirmations

### Deliverables
- Route approval to appointment conversion
- WhatsApp/email confirmation dispatch
- Reminder scheduling
- Cancel/reschedule handling

## Phase 7 — Hardening & Polish

### Deliverables
- Retry logic with idempotency
- Structured logging
- Error recovery UX
- Accessibility audit
- PWA offline capabilities

## Phase 8 — UAT & Launch

### Deliverables
- Release candidate freeze
- UAT environment
- Business flow test scripts
- Mobile device testing
- Production deployment
