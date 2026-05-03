# Client user-story triage — May 2026

**Triage date:** 2026-05-03
**Triage engineer:** Claude Code (resume session, branch `claude/resume-equismile-demo-ROoI3`)
**Source:** Client user story "Administrative Automation for Veterinary Practice"
  — actors Natacha, Kathelijne (vets), Ophélie (admin support)
**Build under triage:** `main@3e443f6` (last merged: PR #103, Vercel deploy-hook).
  PR #104 (`feat(whatsapp-demo)` — DEMO-01..06) is **open + green on CI but
  not yet merged** as of triage time, so its features (yard/horse matchers,
  template registry, `/api/demo/whatsapp-log`, Marie's 2nd yard + 4 horses)
  are **not on `main`** — they will be assumed merged for this triage but
  the human must confirm before showtime.
**Demo target:** Vercel preview, client session next week.

---

## §1 — What was requested

The client wants administrative automation across six areas to reduce the
practice's manual admin load, speed up client response, and minimise
revenue leakage.

| # | Area | Sub-requirements (paraphrased) |
|---|------|---|
| 1 | Appointment management | Auto-process WhatsApp + email enquiries; suggest available slots by schedule + location; vet validates before confirming; send confirmation to client. |
| 2 | Client communication | Auto-respond to common questions on WhatsApp/email; quick standardised replies for frequent inquiries. |
| 3 | Reminders | Annual dental reminders; annual vaccination reminders; overdue-invoice reminders (≥1 month after invoice date, via WhatsApp). |
| 4 | Billing & payments | Register payments **in VetUp** (Swiss vet PMS); generate invoices from **dictated voice messages**; ensure all acts + medications are invoiced. |
| 5 | Accounting preparation | Generate monthly accounting docs from Excel; structured exports for the accountant. |
| 6 | Medical records access | Easy + fast access to dental files. |

Hard acceptance criteria from the story:
- No appointment confirmation without vet approval.
- No automated invoicing — every invoice manually validated before send.
- Overdue-invoice reminder only after **≥30 days** past invoice date,
  channel = **WhatsApp**.
- Auto-replies must be editable and reviewable; vet can override.
- Accountant Excel pipeline reads from manually-prepared input Excels.

---

## §2 — Mapped to existing features

### §2.1 — Appointment management

| Subreq | Status | Evidence | Notes |
|---|---|---|---|
| 1a Auto-process WhatsApp + email | **Built** | `app/api/webhooks/whatsapp/route.ts`, `app/api/webhooks/email/route.ts` → `lib/services/auto-triage.service.ts` | Both webhooks ingest, resolve customer, create Enquiry + VisitRequest, run auto-triage. |
| 1b Suggest available time slots | **Gap** | No slot-suggestion service or `/api/availability` route | `VisitRequest` carries `earliestBookDate`/`latestBookDate` but nothing computes "next 3 free slots" against the vet's calendar. |
| 1c Vet validation before confirm | **Built** | RouteRun status machine (`DRAFT→PROPOSED→APPROVED→BOOKED`); `app/[locale]/route-runs/[id]/page.tsx:207` gates Approve/Reject on status. | Hard match for the client's acceptance criterion. |
| 1d Send confirmed details to client | **Built** | `lib/services/confirmation.service.ts`; `ConfirmationDispatch` audit table; bilingual WhatsApp + email templates. | DEMO-02 (PR #104) routes through `sendTemplateMessage` in DEMO_MODE. |

### §2.2 — Client communication

| Subreq | Status | Evidence | Notes |
|---|---|---|---|
| 2a Auto-respond to common questions | **Gap** | `lib/services/whatsapp.service.ts` has `sendTemplateMessage` but inbound webhook does not auto-reply. | All inbound traffic flows to human triage. |
| 2b Quick standardised replies | **Gap** | `lib/demo/template-registry.ts` (PR #104) holds confirmation/reminder templates only; no operator UI to pick a stock reply against an inbound enquiry. | Closest existing surface is the triage page action buttons (Move/Escalate/Override) — no "Reply with template" action. |

### §2.3 — Reminders

| Subreq | Status | Evidence | Notes |
|---|---|---|---|
| 3a Annual dental reminders | **Partial** | `Horse.dentalDueDate` (`prisma/schema.prisma:273`) + `VisitOutcome.nextDentalDueDate`; no scheduled-dispatch logic. | Field captured at visit-completion; nothing reads it on a cron and fires a message. |
| 3b Annual vaccination reminders | **Gap** | No `vaccinationDueDate`, no vaccination model, no vaccine history. | Schema-level absence — needs additive migration. |
| 3c Overdue invoice reminders (≥30d, WhatsApp) | **Partial** | `Invoice.status` auto-flips to `OVERDUE` (`lib/services/invoice.service.ts:74`); `/finance` displays the count; no outbound dispatch. | `n8n/07-reminder-scheduling.json` polls `/api/reminders/check`, which only dispatches **24h + 2h appointment reminders** — invoice path is absent. |

### §2.4 — Billing & payments

| Subreq | Status | Evidence | Notes |
|---|---|---|---|
| 4a Register payments **in VetUp** | **Gap** | `app/api/export/vetup/route.ts` produces a one-way CSV pull (patients/customers/yards). No reverse sync. | No public VetUp REST API integration; CSV is the only existing bridge. Smallest viable build = "export payments CSV in VetUp's import format" (vs full bidirectional API). Needs the user to confirm what VetUp's payment-import surface actually accepts before sizing. |
| 4b Invoices from voice dictation | **Gap** | Anthropic client (`lib/integrations/anthropic.client.ts`) is vision-only. No audio upload, transcription, or voice→invoice pipeline. | Greenfield. Would need: `/api/voice/upload` route, Whisper or Anthropic-audio call, LLM extraction → draft invoice with vet review gate. |
| 4c All acts + medications invoiced | **Partial** | `ClinicalFinding` (`prisma/schema.prisma:733`) and `Prescription` (line 757) models exist but have **no link to Invoice line items**. Invoices are created manually with free-text line items. | Smallest viable build = a "ready to invoice" checklist on the visit-outcome detail page that lists unbilled findings/prescriptions. |

### §2.5 — Accounting preparation

| Subreq | Status | Evidence | Notes |
|---|---|---|---|
| 5a Monthly Excel accounting docs | **Built (asymmetric)** | `app/api/finance/exports/[ym]/route.ts`; `lib/services/finance-export.service.ts` builds 3-sheet ExcelJS workbook (Summary / Invoices / Payments). | Current pipeline is Excel **output** for the accountant. Client's wording "from Excel files" implies they may be feeding Excel **input** instead — needs a 5-min clarifying chat with the client. **Likely already-covered**, but flagged in §3 because the wording is ambiguous. |
| 5b Structured exports | **Built** | Same export route + `emailMonthlyReport()`. PR #100 added EquiSmile branding to the workbook. | — |

### §2.6 — Medical records access

| Subreq | Status | Evidence | Notes |
|---|---|---|---|
| 6a Easy/fast access to dental files | **Partial** | `app/[locale]/horses/[id]/page.tsx` shows name, age, dentalDueDate, notes, yard, customer — **no clinical history, no DentalChart list, no findings/prescriptions panel.** Schema relations exist (`Horse.dentalCharts`, `findings`, `prescriptions`, `attachments` at `schema.prisma:284`) but are unused by the UI. | The data is there; the surface isn't. XS lift to render existing relations. |

---

## §3 — Confirmed gaps

Severity is **Demo-impact** (does it weaken the client demo narrative
next week?) × **Client-priority** (the hard acceptance criteria).
Size is XS / S / M / L on the round-2 scale.

| ID | Gap | Severity | Demo-impact | Size | Phase |
|---|---|---|---|---|---|
| G-VRC | Vercel demo URL won't get past the login screen — most likely missing `DEMO_MODE`/`DATABASE_URL`/`AUTH_SECRET`/`VERCEL_PREVIEW_MIGRATE` env vars on the Vercel Preview environment, or the Neon integration not installed. | **Critical** | Blocks the demo entirely | XS (config, no code) | 1 |
| G-104 | PR #104 not yet merged → demo doesn't have yard/horse matchers, template registry, WhatsApp message log, or Marie's 2nd yard + 4 horses (Bella/Thunder/Luna/Max). | **Critical** | Demo narrative weakened (no auto-fill, no log panel) | XS (merge action) | 1 |
| G-1b | No availability/slot-suggestion engine. | High (client-priority) | Low — DEMO_RUNBOOK §5 doesn't cover this beat | M (~30–40h: needs a "vet calendar" slot-stream service + UI) | 3 (deferred) |
| G-2a | Inbound webhooks don't auto-reply with FAQ canned replies. | High (client-priority) | Low — would be additive in the demo | M (FAQ store + match service + reviewer-confirm UI) | 3 (deferred) |
| G-2b | No operator UI to send a stock template reply from triage. | Medium | Low | S (4–8h) | 2 (optional) |
| G-3a | Annual dental reminder dispatch not wired (field exists, no cron job to read it). | High (client-priority) | Medium — telling the client "we capture the due date but don't send the reminder yet" softens the story | S (1 service function + cron entry; reuses confirmation pipeline) | 2 (recommended) |
| G-3b | No vaccination tracking on Horse; no scheduled vaccination reminder. | High | Low (no demo beat for it) | S (additive `vaccinationDueDate` migration + UI line; defer the cron) | 2 (recommended for the field; defer cron) |
| G-3c | Overdue-invoice reminder via WhatsApp not dispatched. | High (client acceptance criterion: 30d, WhatsApp) | Medium | S (extend `/api/reminders/check` to scan `Invoice.status=OVERDUE` ≥30d, send via existing WhatsApp service) | 2 (recommended) |
| G-4a | VetUp payment-write integration absent (only CSV pull exists). | High | Low (not in demo beat) | M–L (depends on what VetUp's import API looks like; **client clarification required first**) | 3 (deferred + clarify with client) |
| G-4b | Voice-to-invoice pipeline absent. | High | Low (no demo beat) | L (~30–40h; new audio path, Whisper integration, draft-invoice UI) | 3 (deferred) |
| G-4c | No "unbilled findings/prescriptions" surface on visit outcome. | Medium | Low | S | 3 (deferred) |
| G-5a | Excel-input ingest for accounting unclear vs already-built Excel-output. | Low (likely a misread) | None | XS (verify with client) | 2 (5-min ask) |
| G-6a | Horse detail page lacks clinical-history surface (DentalChart, findings, prescriptions, attachments). | Medium | Medium — tells the "dental file" story directly | XS (one panel; schema already populated) | 2 (recommended) |

**Counting up the recommended Phase-2 gaps:** G-3a, G-3b (field only), G-3c, G-6a — total ≈ S+S+S+XS, fits a single batched PR per the
CLAUDE.md PR-batching rule. Plus the optional G-2b (S) if the human wants
a visible "auto-reply" demo lever.

---

## §4 — PR plan

Per the CLAUDE.md PR-batching rule (one Claude session = one branch =
one PR), Phase 2 work is **one batched PR**, not multiple slices.

### Phase 1 — Vercel demo readiness (no code, ops only)

This must land **before next week's demo**. Steps in §6.

**Action:** human follows §6 setup steps; merges PR #104; triggers a
fresh preview deploy via the deploy hook; verifies `/api/health` returns
green from the preview URL.

**Stop-gate:** before any Phase 2 PR work.

---

### Phase 2 — Demo-narrative polish (one batched PR, recommended)

**Branch:** `feature/userstory-demo-narrative`
**Target:** `main`
**State:** open as **draft**; mark ready-for-review only after the
five-check gate is green locally.

Closes **G-3a, G-3b (field only), G-3c, G-6a**. Optionally G-2b. Skips
G-1b, G-4*, G-5a (deferred / clarify-first).

#### 2.1 — `Horse.vaccinationDueDate` field (G-3b partial, XS)

- Additive migration: `prisma/migrations/<ts>_horse_vaccination_due_date/migration.sql` — `ALTER TABLE "Horse" ADD COLUMN "vaccinationDueDate" TIMESTAMP(3)`. Nullable, no backfill, fully reversible.
- Surface field on `app/[locale]/horses/[id]/page.tsx` next to `dentalDueDate` (one row).
- Add EN/FR i18n keys `horses.vaccinationDue`.
- Seed `prisma/seed-demo.ts` to populate `vaccinationDueDate` on 6–8 demo horses with realistic spread (some overdue, some due within 30d, some clear).
- **Does not** wire a cron-based dispatch — that's deferred to Phase 3 to keep this PR small and reversible.

#### 2.2 — Overdue-invoice WhatsApp reminders (G-3c, S)

- Extend `lib/services/reminder.service.ts` with `dispatchOverdueInvoiceReminders()` — scan `Invoice` rows with `status='OVERDUE'` and `dueAt < NOW() - INTERVAL '30 days'` and `lastReminderSentAt IS NULL OR < NOW() - INTERVAL '14 days'` (debounce). Use existing `whatsappService.sendTemplateMessage` (DEMO-aware via PR #104).
- New column `Invoice.lastReminderSentAt TIMESTAMP NULL` (additive migration).
- New template entry in `lib/demo/template-registry.ts` — `invoice_overdue_reminder` (EN + FR).
- Wire dispatch into `app/api/reminders/check/route.ts` alongside the existing 24h/2h appointment reminders.
- Unit test in `__tests__/unit/services/reminder.service.test.ts`: ≥30d trigger, <30d skip, debounce respected, dispatched event logged to AuditLog.

#### 2.3 — Annual dental reminders (G-3a, S)

- Same pattern as 2.2: extend `reminder.service.ts` with `dispatchDentalDueReminders()` reading `Horse.dentalDueDate` within a 30d look-ahead window, debounced 14d, channel WhatsApp.
- New template entry `dental_due_reminder` (EN + FR).
- Wire into `/api/reminders/check`.
- Unit test for the same trigger/skip/debounce shape.

#### 2.4 — Horse detail clinical-history surface (G-6a, XS)

- Add a "Clinical history" Card section to `app/[locale]/horses/[id]/page.tsx` rendering the existing `dentalCharts`, `findings`, `prescriptions`, `attachments` relations (newest 5 of each, with link to a "see all" page if needed — defer the list page to phase 3).
- Extend `GET /api/horses/[id]` to include the four relations (currently returns only `customer` + `primaryYard`).
- Seed minimum 1 DentalChart + 2 ClinicalFindings + 1 Prescription on Bella (Marie's primary horse) so the demo beat shows real data.
- No new i18n surface beyond a section heading.

#### 2.5 (optional) — Triage "Reply with template" action (G-2b, S)

- New action button on `app/[locale]/triage/page.tsx` action row: "Reply with template" → modal with template picker (FAQ list seeded in `lib/demo/faq-templates.ts`) → confirm-and-send flow that calls `whatsappService.sendTemplateMessage` and logs to `AuditLog` + the existing `WhatsAppMessageLog`.
- Skips automatic auto-reply (G-2a) — this is a vet-confirms-then-sends UX, matching the client's "automated responses must remain editable and reviewable" criterion.
- **Include only if the human wants a "client communication" beat in the demo.** Otherwise omit and document under Phase 3.

#### Verification (whole PR)

```
DATABASE_URL=postgresql://test:test@localhost:5432/test \
  npm run lint && npm run typecheck && npx prisma validate && \
  npm run test && npm run build
```

Manual:
- `/en/horses/<id>` (Bella) shows clinical-history section with seeded data.
- Run `POST /api/reminders/check` with a seed where one invoice is 35d overdue and one horse is dental-due in 14d → verify two WhatsApp dispatches in the demo log.
- Field `vaccinationDueDate` visible on horse detail; persists through edit/refresh.
- Mobile layout intact at 390px on the horse detail page.

#### Stop-gate

Surface the PR URL after push; pause for explicit merge approval. Auth
and finance schema changes warrant human eyes before merge.

---

### Phase 3 — Deferred (post-demo)

| Gap | Defer because | Blocking question for client |
|---|---|---|
| G-1b slot-suggestion | Sized M, needs vet-calendar UX design | Does the practice want a free-form calendar or fixed weekly availability blocks? |
| G-2a auto-reply | Sized M, requires intent-classification rules vs LLM gate | What's the FAQ list? Top 5–10 questions to seed against. |
| G-3a/3b cron dispatch | The field-only Phase 2 work surfaces the data; cron is the next pass | Confirm the dental + vaccine reminder cadence (30d before? 14d before? on the day?). |
| G-4a VetUp payment write | Needs VetUp API spec | Does VetUp expose a REST API for payment ingest, or is bulk CSV import the only path? |
| G-4b Voice→invoice | Sized L (greenfield) | Confirm the workflow: is the vet dictating during the visit (mobile), after the visit (desktop), or both? |
| G-4c Acts/meds checklist | Sized S, depends on 4b for the auto-extract path | Confirm whether the vet wants an enforcement gate (block invoice) or an advisory checklist. |

---

## §5 — Out of scope

| Item | Rationale |
|---|---|
| Native iOS/Android wrappers | Per CLAUDE.md "mobile delivery": PWA-first, native is phase 2+. |
| Customer self-service portal | Per CLAUDE.md "app pattern": internal operational app first. |
| Anthropic-audio integration alongside Whisper | Pick one transcription provider when 4b is built; not a now-decision. |
| Automatic invoice send (no manual gate) | Explicitly forbidden by the client's acceptance criteria. |
| Renaming "Excel input" vs "Excel output" before clarifying with client | Wider scope than the gap warrants — chat first. |
| Re-enabling Copilot Autofix on the repo | Out of scope per `docs/OPERATIONS.md` §5 — incident on PR #61, intentionally left off. |

---

## §6 — Vercel demo readiness — explicit setup steps

The handover names the most likely root causes, ranked. Walk these
in order; stop at the first one that fixes it.

### 6.1 — Confirm which URL is failing

Before any change: identify which Vercel deployment the demo URL points
at — production custom domain or `equismile-git-<branch>-<team>.vercel.app`
preview. The required env vars differ.

### 6.2 — Set Preview-environment env vars

In **Vercel Dashboard → equismile project → Settings → Environment
Variables**, ensure the following are set with the **Preview** checkbox
ticked. (Production needs the same minus `DEMO_MODE` and
`VERCEL_PREVIEW_MIGRATE`.)

| Var | Value | Why |
|---|---|---|
| `DATABASE_URL` | Neon Vercel-integration auto-populated, OR a preview-only Postgres URL | Without this, build fails at import time. |
| `AUTH_SECRET` | `openssl rand -base64 32` (different from production) | Auth.js refuses to mint sessions without it. |
| `N8N_API_KEY` | Any pseudo-random string | Set this on Preview too: when `DEMO_MODE=true`, an unset key can allow anonymous webhook access; handlers only fail-closed when demo mode is off. Preview URLs are public, so use a real random value. |
| `DEMO_MODE` | `true` | Without this, `/api/demo/sign-in` and the persona-picker card are disabled; reviewers will land on the standard login page and must authenticate via a real OAuth provider. Enables WhatsApp/email simulators. |
| `VERCEL_PREVIEW_MIGRATE` | `true` | Tells `scripts/vercel-build.sh` to run `prisma migrate deploy` + (because `DEMO_MODE=true`) `prisma db seed`. |

Leave **unset** on Preview unless explicitly needed: `AUTH_URL`,
`NEXT_PUBLIC_APP_URL`, `EQUISMILE_LIVE_MAPS`, all GCP keys.

### 6.3 — Install the Neon Vercel integration (if not already)

Vercel Marketplace → Neon → Install → link `equismile` project. Neon
auto-populates `DATABASE_URL` per Preview branch. **Untick Production**
on the Neon-managed `DATABASE_URL` if a production Postgres exists
elsewhere.

### 6.4 — Merge PR #104

PR #104 is open + green on CI. Without it on `main`:
- Inbound WhatsApp messages don't auto-fill yardId/horses (DEMO-03 missing).
- Confirmation messages don't route through the template registry (DEMO-02 missing).
- The `/demo` page has no `WhatsAppMessageLog` panel (DEMO-05 missing).
- Marie Dupont has only one yard, no named horses (DEMO-06 missing).

The demo runbook's beat 4 (Sarah Mitchell's planning entry with two
horses) still works without #104, but the Marie WhatsApp arc is broken.
**Recommended**: human merges PR #104 before any Phase 2 work.

### 6.5 — Trigger a fresh deploy

After §6.2–§6.4, force a redeploy so the Preview env picks up new
vars + the merged #104:

```sh
# Option A: GitHub Actions UI → "Vercel deploy (manual trigger)"
# Option B: Local helper (reads VERCEL_DEPLOY_HOOK_URL from .env.local)
bash scripts/trigger-vercel-deploy.sh
# Option C: Direct curl
curl -fsS -X POST "$VERCEL_DEPLOY_HOOK_URL"
```

Returns `{"job":{"id":"…","state":"PENDING"}}`. Track at
`https://vercel.com/dashboard`.

### 6.6 — Verify

Once the new deploy is live, hit `/api/health` from the test device:

```sh
curl -fsS https://<the-preview-url>/api/health | jq .
```

Expect:
- `checks.database.status: "up"`
- `checks.environment.status: "ok"` — `missing[]` is empty. (The only required var tracked here is `DATABASE_URL`; optional Group-B/C vars are not listed.)

Then from the test device, open `/en/login` and confirm:
- The "Continue as Demo Vet" persona-picker card is visible.
- Clicking it lands you on `/en/dashboard` already signed in as
  Dr. Kathelijne Deberdt.
- Build SHA visible in the login footer (matches the merged commit).

If `/api/health` returns 503, the overall `status` will be `"unhealthy"`. Two conditions trigger this:
- `checks.database.status: "down"` — verify `DATABASE_URL` is set and the Neon branch is live.
- `checks.environment.status: "missing"` — `DATABASE_URL` is unset. Set it in Vercel and redeploy.

### 6.7 — Pre-demo dry run (T-24h)

24 hours before the client session:

1. Trigger a fresh deploy (re-seeds the demo DB to canonical state).
2. Walk the eight beats from `docs/DEMO_RUNBOOK.md` §5 on the actual
   demo device (iPhone Safari).
3. Confirm the WhatsApp message-log panel on `/demo` shows the
   simulated Marie message routing (post-#104).
4. Verify mobile layout at 390px on every page.
5. Capture the build SHA + URL into a delivery note for the client.

---

## Summary — recommended next moves

1. **Operator action (you):** walk §6.1–§6.6 to unblock the Vercel demo,
   merge PR #104, redeploy, verify `/api/health` green.
2. **Approve / amend Phase 2 PR scope** (§4): default recommendation
   is 2.1–2.4 batched + skip the optional 2.5. Indicate which
   stop-gates require human approval at merge time vs auto-merge.
3. **Defer Phase 3 explicitly** (§4 deferred table) and surface the
   six clarifying questions to the client during next week's session
   so we can size the post-demo backlog accurately.
4. After human approval, I open one draft PR for Phase 2, run the
   five-check gate locally, push, and pause for merge approval.

*End of triage. Awaiting human approval before any code PR.*
