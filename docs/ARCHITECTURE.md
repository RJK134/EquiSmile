# EquiSmile Architecture

## System Overview

EquiSmile is a bilingual (English/French) mobile-first field-service operations platform for equine dental veterinary practice. The system manages the full lifecycle from enquiry intake through triage, route planning, appointment booking, and visit outcome tracking.

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16 App Router | Server-rendered React with mobile-first responsive design |
| Language | TypeScript (strict mode) | Type safety throughout |
| Styling | Tailwind CSS v4 | Utility-first mobile-first CSS |
| Internationalisation | next-intl | EN/FR bilingual support |
| Backend | Next.js Route Handlers | API layer within same repo |
| Database | PostgreSQL 16 | Relational data storage |
| ORM | Prisma 6 | Type-safe database access with migrations |
| Automation | n8n (self-hosted) | Workflow orchestration for messaging intake, triage, geocoding, route planning |
| Messaging | Meta WhatsApp Cloud API | Primary customer communication channel |
| Email | Nodemailer | SMTP email sending |
| Maps | Google Geocoding + Route Optimisation API | Address resolution and route planning |
| PWA | Serwist | Service worker, offline support, installability |
| Validation | Zod | Runtime schema validation |
| Testing | Vitest + React Testing Library | Unit and integration testing |
| Deployment | Docker Compose | Local development and VPS deployment |
| CI/CD | GitHub Actions | Automated lint, type check, test, build, Docker build |

## Application Architecture

```
┌─────────────────────────────────────────────────┐
│                   Client (PWA)                   │
│         Mobile-first responsive web app          │
│              next-intl (EN / FR)                 │
├─────────────────────────────────────────────────┤
│              Next.js App Router                   │
│           Route Handlers (API layer)             │
├─────────────────────────────────────────────────┤
│            Service / Repository Layer             │
│      Business logic + data access patterns       │
├─────────────────────────────────────────────────┤
│                  Prisma ORM                       │
├─────────────────────────────────────────────────┤
│               PostgreSQL 16                       │
├─────────────────────────────────────────────────┤
│                    n8n                            │
│    WhatsApp │ Email │ Geocoding │ Routes          │
└─────────────────────────────────────────────────┘
```

## Data Model Overview

### Core Entities
- **Customer** — client with contact preferences and preferred language (EN/FR)
- **Yard** — location where horses are kept, with geocoded address
- **Horse** — individual animal linked to customer and yard, with dental tracking

### Enquiry Pipeline
- **Enquiry** — inbound message (WhatsApp or email) linked to customer
- **EnquiryMessage** — individual messages within an enquiry thread
- **VisitRequest** — structured visit request parsed from enquiry
- **TriageTask** — tasks for manual review or information gathering
- **TriageAuditLog** — audit trail for triage overrides and changes

### Route Planning
- **RouteRun** — a planned day of visits with optimised route
- **RouteRunStop** — individual stop within a route run

### Booking & Outcomes
- **Appointment** — confirmed appointment linked to visit request and route run
- **VisitOutcome** — outcome record after appointment completion

## Folder Structure

```
app/                    # Next.js App Router pages
  [locale]/             # Locale-prefixed routes (en, fr)
    dashboard/          # Operations dashboard
    enquiries/          # Enquiry management
    customers/          # Customer management
    horses/             # Horse management
    yards/              # Yard management
    appointments/       # Appointment management
    route-runs/         # Route planning
    triage/             # Triage operations
    planning/           # Planning pool
  api/                  # API route handlers
    appointments/       # Appointment CRUD + actions
    customers/          # Customer CRUD
    enquiries/          # Enquiry CRUD
    horses/             # Horse CRUD
    yards/              # Yard CRUD
    visit-requests/     # Visit request CRUD
    triage-tasks/       # Triage task CRUD
    route-planning/     # Geocode, generate, proposals
    n8n/                # n8n webhook endpoints
    triage/             # Triage override, follow-up, audit
    webhooks/           # WhatsApp, email intake
    reminders/          # Reminder scheduler
    health/             # Health check
components/             # Shared React components
  layout/               # Header, Sidebar, MobileNav, LanguageSwitcher
  ui/                   # Button, Badge, Card, Modal, Toast, etc.
lib/                    # Shared utilities and helpers
  hooks/                # React hooks (useFormAutoSave)
  repositories/         # Data access layer (Prisma queries)
  services/             # Business logic services
  utils/                # Logging, retry, env-check, etc.
  validations/          # Zod schemas
prisma/                 # Database schema and migrations
messages/               # i18n translation files (en.json, fr.json)
i18n/                   # next-intl configuration
n8n/                    # Exported n8n workflow JSON
scripts/                # Operational scripts
  preflight-check.ts    # Pre-deployment validation
  validate-environment.ts # Full environment validation
docs/                   # Documentation
  uat/                  # UAT test scripts (TC-001 to TC-008)
.github/workflows/      # CI/CD
public/                 # Static assets, PWA manifest
```

## Service Layer

### Enquiry Processing
- `enquiry.service.ts` — enquiry creation, customer matching
- `message-log.service.ts` — message thread tracking

### Triage
- `auto-triage.service.ts` — automated urgency classification (EN/FR)
- `triage-rules.service.ts` — rule engine for classification
- `missing-info.service.ts` — detect missing information in enquiries
- `triage.service.ts` — triage task management
- `status-machine.service.ts` — enforce valid triage transitions

### Route Planning
- `geocoding.service.ts` — Google Geocoding API integration
- `clustering.service.ts` — geographic clustering by postcode area
- `route-scoring.service.ts` — urgency, proximity, time-window scoring
- `route-optimizer.service.ts` — Google Route Optimisation integration
- `route-proposal.service.ts` — proposal generation and management
- `planning.service.ts` — planning pool management

### Booking
- `booking.service.ts` — appointment creation from approved routes
- `confirmation.service.ts` — bilingual confirmation dispatch
- `reminder.service.ts` — 24h/2h reminder scheduling
- `reschedule.service.ts` — appointment rescheduling
- `visit-outcome.service.ts` — outcome recording

### Communications
- `whatsapp.service.ts` — Meta WhatsApp Cloud API
- `email.service.ts` — Nodemailer SMTP

## Hardening Layer (Phase 7)

### Reliability
- **Retry wrapper** (`lib/utils/retry.ts`) — Exponential backoff with jitter for all external API calls
- **Idempotency** — Outbound messages use idempotency keys to prevent duplicates on retry

### Observability
- **Structured logging** (`lib/utils/logger.ts`) — JSON-formatted logs with context fields and sensitive data masking
- **Health check** (`/api/health`) — Database, n8n, WhatsApp, SMTP, and Google Maps status
- **Environment validation** (`lib/utils/env-check.ts`) — Startup pre-flight checks

### Error Recovery UX
- **Error boundaries** — React ErrorBoundary wraps all pages with friendly retry UI
- **Toast notifications** — Success/error feedback on mutations
- **Offline banner** — Network-down detection with stale data indicator
- **Form auto-save** — localStorage persistence for long forms

### Accessibility (WCAG 2.1 AA)
- Focus indicators on all interactive elements
- Skip-to-content link for keyboard navigation
- Proper ARIA roles, labels, and landmarks
- Focus trap in modals
- 44px minimum touch targets on mobile

### Performance
- Loading skeletons for all data states
- Pagination component for list views
- Responsive table/card transitions

### Mobile
- Bottom sheet action component (mobile) / modal (desktop)
- Safe-area insets for notched devices
- Responsive table-to-card breakpoint transitions

### PWA Offline
- IndexedDB-backed offline request queue
- Automatic retry of queued mutations when back online
- Offline banner with service worker message passing

## Deployment

### Development
```bash
docker compose up -d    # PostgreSQL + n8n
npm run dev             # Next.js dev server
```

### Production
```bash
docker compose up -d    # PostgreSQL + n8n + app
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full production deployment guide.

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| WhatsApp provider | Meta Cloud API | Lower cost, direct control, fewer moving parts |
| Mobile delivery | Responsive PWA | Single codebase, works on all devices |
| App pattern | Internal-first | Operational efficiency before public-facing polish |
| i18n library | next-intl | Best Next.js App Router integration |
| CSS framework | Tailwind v4 | Mobile-first utility classes |
| Testing | Vitest | Fast, TypeScript-native, compatible with React Testing Library |
| State management | Server-side | Next.js route handlers with Prisma, minimal client state |
| Automation | n8n | Visual workflow builder for non-developers, self-hosted |
| Deployment | Docker Compose | Simple single-server deployment suitable for small practice |
| Email intake | n8n (not direct IMAP) | n8n handles inbound email polling via workflow `02-inbound-email.json`. The app does not use direct IMAP connections — all email intake is routed through n8n webhooks to the app's `/api/webhooks/email` endpoint. |
