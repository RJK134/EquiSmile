# CLAUDE.md

## Project
EquiSmile is a mobile-first field-service operations platform for an equine dental veterinary business. The product ingests WhatsApp and email enquiries, triages clinical and routine requests, groups geographically compatible visits, proposes efficient route runs, confirms appointments, and tracks visit outcomes.

Primary repo: `RJK134/Equismile`

## Product goals
- Provide a fast mobile-first internal app for the vet and optional admin support.
- Centralise inbound WhatsApp and email communications.
- Convert messages into structured visit requests.
- Route urgent requests for immediate review.
- Batch routine work into sensible local appointment runs.
- Reduce wasted driving and admin time.

## Preferred architecture
- Frontend: Next.js 14+ App Router, TypeScript, Tailwind, responsive mobile-first UI.
- Backend: Next.js server actions / route handlers or lightweight Node service within the same repo.
- Database: PostgreSQL + Prisma.
- Automation: n8n for messaging intake, triage orchestration, geocoding, route planning, reminders, confirmations.
- Messaging: Meta WhatsApp Cloud API as primary choice; Twilio only if Meta onboarding blocks progress.
- Maps: Google Geocoding API + Route Optimization API.
- Deployment: Docker Compose for local and VPS-style deployment.
- Internationalisation: next-intl with EN (default) and FR locales.

- ## Memory Management

When you discover something valuable for future sessions - architectural decisions, bug fixes, gotchas, environment quirks - immediately append it to .claude/memory.md
Don't wait to be asked. Don't wait for session end.
Keep entries short: date, what, why. Read this file at the start of every session.

## Preferred vendor decisions
### WhatsApp
Use **Meta WhatsApp Cloud API first**.
Reasons:
- Lower ongoing cost than Twilio for this use case because Twilio adds a platform fee on top of Meta pricing.
- Direct control and fewer moving parts.

### Mobile delivery
Build a **responsive web app / PWA first**, not native iOS or Android apps.
Reasons:
- Fastest and cheapest route to production.
- Single codebase.
- Works on iPhone and Android.
- Can be installed to home screen.
Native wrappers are phase 2+ only if a strong device integration need appears.

### App pattern
Internal operational app first, customer-facing self-service later.
The first goal is operational efficiency, not public-facing polish.

## Delivery principles
- Build in small, reviewable phases.
- One PR per coherent slice.
- Keep PRs small enough for effective review.
- Never widen scope without explicit instruction.
- Every phase must end with: working code, tests, docs update, verification note.
- Use British English in UI and docs unless API fields require otherwise.
- Never commit secrets.
- Use Prisma migrations, never ad hoc production schema edits.
- Prefer additive, reversible migrations.

## Git workflow
- Branch naming: `feature/<phase>-<short-name>`, `fix/<scope>`, `chore/<scope>`.
- Commit often with meaningful messages.
- Open PR early as draft.
- Request review from Copilot on each PR.
- Use Claude Code for implementation and structured verification.
- Prefer squash merge to keep history clean.

## Non-negotiable checks
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npx prisma validate`
- `npx prisma migrate diff` or migration verification where applicable
- Build passes
- Mobile layout checked at 390px width minimum

## Domain rules
- Urgent symptoms include pain, swelling, bleeding, not eating, significant distress.
- Routine work should be batchable into local route runs.
- Multi-horse yards should be favoured in route planning.
- Human approval required before route proposals become confirmed appointments.
- All outbound customer messaging must be logged.

## Coding rules
- TypeScript strict mode.
- Avoid `any`.
- Validate external payloads.
- Add error handling and observability for all external integrations.
- Prefer small pure functions for parsing and scoring logic.
- Keep route optimisation payload builders isolated and testable.
- Keep n8n JSON workflow exports in version control under `/n8n`.

## Folder expectations
- `app/` and `components/` for UI.
- `lib/` for shared utilities.
- `server/` or `src/server/` for integration services if needed.
- `prisma/` for schema and migrations.
- `n8n/` for exported workflow JSON.
- `docs/` for specs, runbooks, verification, and known issues.
- `.claude/` for agents and commands.

## Required docs
- `docs/BUILD_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/PR_REVIEW_CHECKLIST.md`
- `docs/KNOWN_ISSUES.md`
- `docs/SETUP.md`

## Phase model
Deliver through explicit phases. Each phase should end with:
- implemented scope
- tests added/updated
- docs updated
- verification summary
- PR ready for review

## Stop conditions
Stop and ask for guidance if:
- a breaking architectural choice is required
- a third-party integration blocks progress
- a bug fix would widen scope beyond the current phase
- route optimisation API behaviour conflicts with product needs
