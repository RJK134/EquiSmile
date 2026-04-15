# Changelog

All notable changes to EquiSmile are documented in this file.

## [1.0.0] — 2026-04-15

### Phase 8 — UAT & Launch Preparation
- Release candidate freeze (`rc/v1.0.0`)
- Comprehensive UAT test scripts (TC-001 through TC-008) covering all business flows
- Environment validation script (`npm run validate-env`) with clear pass/fail output
- Production readiness checklist and deployment guide
- Enhanced seed data with realistic UK equine dental scenarios
- Multi-stage production Dockerfile and updated Docker Compose
- CI/CD enhancements: Docker build test, security audit, production build verification
- Final documentation update across all docs

### Phase 7 — Hardening & Polish
- Exponential-backoff retry wrapper with jitter for all external API calls
- Structured JSON logging with sensitive-data masking
- Health check endpoint (`/api/health`) covering database, n8n, WhatsApp, SMTP, Google Maps
- Error boundary with friendly retry UI on all pages
- Toast notification system for mutation feedback
- Offline banner with stale-data indicator and service-worker integration
- Form auto-save to localStorage for long forms
- WCAG 2.1 AA accessibility: focus indicators, skip-to-content, ARIA roles, focus trap in modals
- 44px minimum touch targets on mobile
- Loading skeletons and pagination for all list views
- Bottom sheet (mobile) / modal (desktop) action component
- Safe-area insets for notched devices
- PWA offline request queue with automatic retry on reconnect
- Pre-flight check script (`npm run preflight`)
- Migration rollback documentation

### Phase 6 — Booking & Confirmations
- Appointment creation from approved route runs
- WhatsApp and email confirmation dispatch in customer's preferred language (EN/FR)
- 24-hour and 2-hour reminder scheduling
- Appointment cancellation with return-to-pool workflow
- Appointment rescheduling
- Visit completion with outcome recording
- Follow-up visit request creation
- No-show marking

### Phase 5 — Route Planning
- Google Geocoding API integration for yard addresses
- Batch geocoding for multiple yards
- Geographic clustering of visit requests by postcode area
- Route scoring algorithm (urgency, proximity, time-window fit)
- Google Route Optimisation API integration
- Route proposal generation, review, approval, and rejection
- Planning pool management

### Phase 4 — Triage Operations
- Auto-triage rules engine with EN and FR text classification
- Missing-information auto-detection (postcode, horse count, symptoms)
- Triage task queue with manual assignment
- Manual override for urgency level changes with audit logging
- SLA breach escalation
- Status machine enforcing valid triage transitions
- Triage audit log

### Phase 3 — Messaging Intake
- Meta WhatsApp Cloud API webhook handler with signature verification
- Email/IMAP intake endpoint via n8n
- Message logging with thread tracking
- n8n-to-app REST contract (typed endpoints for all integrations)
- Duplicate message handling via external message ID

### Phase 2 — Core Features
- Customer CRUD with bilingual UI (EN/FR)
- Yard management with full UK address fields
- Horse management linked to customer and yard
- Manual enquiry creation (routine and urgent)
- Triage classification interface
- Planning pool view with status filters
- Operations dashboard with key metrics
- Repository/service layer architecture

### Phase 1 — Foundation
- PWA shell with Serwist service worker
- Docker Compose configuration (PostgreSQL 16 + n8n)
- Prisma migration initialisation
- Idempotent seed data
- Environment variable validation
- Health check API endpoint (`/api/health`)
- GitHub Actions CI pipeline

### Phase 0 — Scaffold
- Next.js 16 App Router with TypeScript strict mode
- Tailwind CSS v4 with mobile-first responsive design
- next-intl bilingual support (EN/FR)
- Prisma schema with complete data model (12 models, 16 enums)
- Shared component library (layout, UI components)
- Vitest test scaffolding
- ESLint and Prettier configuration
- Project documentation skeleton
