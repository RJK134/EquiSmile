# EquiSmile Architecture

## System Overview

EquiSmile is a bilingual (English/French) mobile-first field-service operations platform for equine dental veterinary practice. The system manages the full lifecycle from enquiry intake through triage, route planning, appointment booking, and visit outcome tracking.

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14+ App Router | Server-rendered React with mobile-first responsive design |
| Language | TypeScript (strict mode) | Type safety throughout |
| Styling | Tailwind CSS v4 | Utility-first mobile-first CSS |
| Internationalisation | next-intl | EN/FR bilingual support |
| Backend | Next.js Server Actions / Route Handlers | API layer within same repo |
| Database | PostgreSQL 16 | Relational data storage |
| ORM | Prisma | Type-safe database access with migrations |
| Automation | n8n (self-hosted) | Workflow orchestration for messaging intake, triage, geocoding, route planning |
| Messaging | Meta WhatsApp Cloud API | Primary customer communication channel |
| Maps | Google Geocoding + Route Optimisation API | Address resolution and route planning |
| Deployment | Docker Compose | Local development and VPS deployment |

## Application Architecture

```
┌─────────────────────────────────────────────────┐
│                   Client (PWA)                   │
│         Mobile-first responsive web app          │
│              next-intl (EN / FR)                 │
├─────────────────────────────────────────────────┤
│              Next.js App Router                   │
│      Server Actions / Route Handlers             │
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
- **Customer** — client with contact preferences and preferred language
- **Yard** — location where horses are kept, with geocoded address
- **Horse** — individual animal linked to customer and yard

### Enquiry Pipeline
- **Enquiry** — inbound message (WhatsApp or email) linked to customer
- **EnquiryMessage** — individual messages within an enquiry thread
- **VisitRequest** — structured visit request parsed from enquiry
- **TriageTask** — tasks for manual review or information gathering

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
    route-runs/         # Route planning
    appointments/       # Appointment management
  api/                  # API route handlers
components/             # Shared React components
  layout/               # Navigation, header, sidebar
  ui/                   # Reusable UI components
lib/                    # Shared utilities and helpers
prisma/                 # Database schema and migrations
messages/               # i18n translation files (en.json, fr.json)
i18n/                   # next-intl configuration
n8n/                    # Exported n8n workflow JSON
docs/                   # Documentation
.claude/                # Claude Code agent configuration
.github/                # CI/CD workflows
```

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| WhatsApp provider | Meta Cloud API | Lower cost, direct control, fewer moving parts |
| Mobile delivery | Responsive PWA | Single codebase, works on all devices |
| App pattern | Internal-first | Operational efficiency before public-facing polish |
| i18n library | next-intl | Best Next.js App Router integration |
| CSS framework | Tailwind v4 | Mobile-first utility classes |
| Testing | Vitest | Fast, TypeScript-native, compatible with React Testing Library |
