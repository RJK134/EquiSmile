# EquiSmile

Bilingual (EN/FR) mobile-first field-service operations platform for equine dental veterinary practice.

EquiSmile manages the complete customer lifecycle: WhatsApp and email enquiry intake, intelligent triage with auto-classification, geographic route planning and optimisation, appointment booking with bilingual confirmations, and visit outcome tracking — all from a Progressive Web App that works on any device.

## Features

- **Multi-channel intake** — WhatsApp and email enquiries via Meta Cloud API and IMAP, with duplicate detection and thread tracking
- **Intelligent triage** — Auto-classification of urgency from English and French text, missing-info detection, manual override with audit trail
- **Route planning** — Google Geocoding, geographic clustering, route scoring, and Google Route Optimisation for efficient multi-stop routes
- **Booking & confirmations** — Appointment creation from approved routes, bilingual WhatsApp/email confirmations, 24h/2h reminders
- **Visit outcomes** — Completion recording, follow-up scheduling, no-show tracking
- **Bilingual** — Full EN/FR UI with language switcher, customer communications in preferred language
- **Mobile-first PWA** — Installable on iOS/Android, offline support with request queue, 44px touch targets
- **Reliability** — Retry with exponential backoff, structured logging, health checks, error boundaries
- **Accessibility** — WCAG 2.1 AA compliant

## Tech Stack

| Layer | Technology |
|-------|-----------|
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
| CI/CD | GitHub Actions, Docker |

## Demo Mode (Quick Start)

Run a fully working demo with simulated integrations — no API keys needed:

### Option 1: Docker (recommended)
```bash
./scripts/demo-start.sh
```
Open http://localhost — that's it.

### Option 2: Local development
```bash
./scripts/demo-start-local.sh
```
Open http://localhost:3000

### Windows

**Command Prompt (recommended):**
```cmd
scripts\demo-start-local.bat
```

**PowerShell:**
```powershell
.\scripts\demo-start.ps1
```

**Docker only (no Node.js required):**
```cmd
scripts\demo-start.bat
```

**One-click launchers (vet workstation):**
Windows batch launchers (`DEMO.bat`, `LAUNCH.bat`, `REBUILD.bat`, `FIX.bat`, etc.) live under `scripts/windows/`. See `scripts/windows/README.md` for what each one does.

### What's in the demo
- 8 Swiss customers (4 French, 4 English) across Vaud, Fribourg, Valais
- 20 horses with clinical histories
- 12 enquiries at various triage stages
- Pre-built route runs and appointments
- Simulated WhatsApp, email, geocoding, and route optimization
- Demo control panel at `/en/demo` to trigger live simulations

## Quick Start (Development)

```bash
# Clone and install
git clone https://github.com/RJK134/EquiSmile.git
cd EquiSmile
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings (DATABASE_URL at minimum)

# Start infrastructure
docker compose up -d

# Set up database
npm run db:generate
npm run db:migrate
npm run db:seed        # Optional: load test data

# Validate environment
npm run validate-env

# Start dev server
npm run dev
```

App available at [http://localhost:3000](http://localhost:3000).

## Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](docs/SETUP.md) | Development environment setup |
| [Architecture](docs/ARCHITECTURE.md) | System architecture and design decisions |
| [Build Plan](docs/BUILD_PLAN.md) | Development phases and deliverables |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deployment step-by-step |
| [Production Readiness](docs/PRODUCTION_READINESS.md) | Go-live checklist |
| [n8n API Contract](docs/N8N_CONTRACT.md) | REST contract between app and n8n |
| [Release Notes](docs/RELEASE_NOTES_v1.0.0.md) | v1.0.0 feature summary |
| [Known Issues](docs/KNOWN_ISSUES.md) | Current known issues and workarounds |
| [UAT Plan](docs/uat/UAT_PLAN.md) | User acceptance testing plan and test cases |
| [Test Strategy](docs/TEST_STRATEGY.md) | Testing approach and coverage |
| [Migration Safety](docs/migration-safety.md) | Database migration rollback procedures |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run test suite |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Seed test data |
| `npm run validate-env` | Validate environment and services |
| `npm run preflight` | Pre-deployment checks |

## Contributing

1. Create a feature branch from `main`
2. Follow existing code patterns and conventions
3. Ensure all checks pass: `npm run lint && npm run typecheck && npm run test && npm run build`
4. Write tests for new functionality
5. Create a pull request with clear description

## Licence

Private — all rights reserved.
