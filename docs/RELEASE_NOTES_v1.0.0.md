# EquiSmile v1.0.0 — Release Notes

**Release Date:** 2026-04-15
**Tag:** `rc/v1.0.0`

## What is EquiSmile?

EquiSmile is a bilingual (English/French) mobile-first field-service operations platform built for equine dental veterinary practice. It manages the complete customer lifecycle from enquiry intake through triage, route planning, appointment booking, and visit outcome tracking.

## Key Features

### Customer & Animal Management
- Full customer profiles with preferred language (EN/FR) and communication channel
- Yard management with UK address fields and geocoded locations
- Horse records with dental tracking and due dates

### Multi-Channel Enquiry Intake
- WhatsApp message intake via Meta Cloud API with signature verification
- Email intake via IMAP with n8n workflow automation
- Manual enquiry creation for phone and walk-in contacts
- Duplicate message detection and thread tracking

### Intelligent Triage
- Auto-triage rules engine classifying urgency from EN and FR text
- Missing-information detection with automated follow-up requests
- Manual override with full audit trail
- SLA breach escalation

### Route Planning & Optimisation
- Google Geocoding for yard addresses
- Geographic clustering by postcode area
- Route scoring by urgency, proximity, and time-window fit
- Google Route Optimisation API for efficient multi-stop routes
- Route proposal workflow: generate → review → approve/reject

### Booking & Confirmations
- Automatic appointment creation from approved routes
- Bilingual confirmation messages via WhatsApp or email
- 24-hour and 2-hour reminder scheduling
- Cancel, reschedule, and no-show workflows
- Visit outcome recording with follow-up scheduling

### Mobile & Offline
- Progressive Web App (PWA) installable on iOS and Android
- Offline request queue with automatic sync on reconnect
- Bottom navigation optimised for mobile devices
- 44px touch targets and safe-area insets for notched devices

### Bilingual Support
- Complete EN/FR UI with language switcher
- Customer communications in their preferred language
- Triage rules work for both English and French text input
- Date and time formatting respects locale

### Reliability & Observability
- Exponential-backoff retry with jitter on all external API calls
- Structured JSON logging with sensitive-data masking
- Health check endpoint covering all service dependencies
- Error boundaries with friendly retry UI
- Form auto-save to prevent data loss

### Accessibility
- WCAG 2.1 AA compliant focus indicators
- Skip-to-content link for keyboard navigation
- Proper ARIA roles, labels, and landmarks
- Focus trap in modals

## Technical Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| i18n | next-intl |
| Database | PostgreSQL 16 |
| ORM | Prisma 6 |
| Automation | n8n (self-hosted) |
| PWA | Serwist |
| Messaging | Meta WhatsApp Cloud API, Nodemailer |
| Maps | Google Geocoding & Route Optimisation |
| Testing | Vitest, React Testing Library |

## Getting Started

See [SETUP.md](./SETUP.md) for development environment setup.
See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment.
See [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for the go-live checklist.

## Known Issues

See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for current known issues and workarounds.
