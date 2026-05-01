# UAT v1.1 Triage & Overnight Build Plan

**Triage date:** 2026-04-30
**Triage engineer:** Claude Code (post-UAT)
**UAT tester:** Dr. Rachel Kemp (Vet Operator persona)
**UAT verdict:** Not yet — demo not ready to show investors

---

## §1 — What was tested

| Field | Detail |
|-------|--------|
| Date | 2026-04-30 |
| Tester persona | Dr. Rachel Kemp — equine dental vet, primary operator |
| Environment | DEMO_MODE=true, Docker Compose, local VPS |
| Session tools | Perplexity-based browser automation (note: misreports 303 redirects as 503) |
| Scope | Sign-in flow, Planning tab, Triage tab, Appointment detail, Mobile nav, Seed data, i18n (EN + FR) |
| Build ref | PR #66, commit 7d2abc0 |

Rachel's test session covered the complete demo narrative: arriving at the login page → signing in as Demo Vet → reviewing the triage queue → approving a route run → opening an appointment detail → switching to French locale. She logged 14 findings, of which 10 are confirmed code issues and 4 are out of scope for this build.

---

## §2 — Confirmed gaps

| # | Rachel's finding | Classification | Priority | PR |
|---|-----------------|---------------|---------|-----|
| 1 | Demo sign-in returns 503 / no error feedback | Demo-blocker / High | P1 | PR-A |
| 2 | Generate Routes button navigates instead of generating | Demo-blocker / High | P1 | PR-B |
| 3 | Appointment action buttons absent on confirmed appt | Demo-blocker / High | P1 | PR-C |
| 4 | Override button missing from Triage row actions | Operator-UX / Medium | P2 | PR-D |
| 5 | Confirmation channel pill absent on appointment detail | Operator-UX / Medium | P2 | PR-E |
| 6 | Triage absent from mobile bottom nav | Operator-UX / Medium | P2 | PR-F |
| 7 | Triage status labels untranslated (URGENT_REVIEW etc.) | Operator-UX / Medium | P2 | PR-G |
| 8 | Invoice status enum tokens untranslated | Operator-UX / Medium | P2 | PR-G |
| 9 | status.not_needed key missing in both locales | Operator-UX / Medium | P2 | PR-G |
| 10 | Date/time output follows browser locale, not next-intl locale | Polish / Low | P3 | PR-H |
| 11 | 503 root cause (Perplexity tool misreports 303 redirect) | Out-of-scope / Won't fix | — | — |
| 12 | Native iOS/Android app request | Out-of-scope / Phase 2+ | — | — |
| 13 | Customer self-service portal | Out-of-scope / Phase 2+ | — | — |
| 14 | Route optimisation map view | Out-of-scope / Phase 2+ | — | — |

### Root-cause notes

**Finding 1 (sign-in 503):** `app/api/demo/sign-in/route.ts` has no 503 return path. The handler returns 404 outside DEMO_MODE and 303 on success. Rachel's Perplexity browser tool misreported the 303 as 503. The real bug is a UX gap: the vanilla HTML `<form>` gives zero feedback on any non-redirect response — a real failure (e.g. DEMO_MODE unset) would silently blank the page.

**Finding 2 (Generate Routes):** `app/[locale]/planning/page.tsx` line 86 calls `router.push('/route-runs')` — pure navigation. The actual generation endpoint `app/api/route-planning/generate/route.ts` exists and is correct; it is simply not wired to the button.

**Finding 3 (appointment buttons):** The buttons exist and are correctly guarded by `isActive` (status PROPOSED | CONFIRMED). The bug is seed drift: `prisma/seed-demo.ts` uses `update: {}` for every upsert, so re-seeding never restores `demo-appt-confirmed` to CONFIRMED status after Rachel's session mutated it to COMPLETED.

**Finding 4 (override button):** The override modal is fully implemented in `app/[locale]/triage/page.tsx` (lines 405–427) with `overrideModal` state at line 79 and `handleOverrideSubmit`. No button in the row-actions block (lines 376–397) calls `setOverrideModal({...})`.

**Finding 5 (channel pill):** `confirmationChannel` is included in the API response shape but the appointment detail page never renders it anywhere.

**Finding 6 (mobile nav):** `components/layout/MobileNav.tsx` has four nav slots; the fourth is hardcoded to `/customers` with label "more". Triage has no slot.

**Findings 7–9 (i18n):** `messages/en.json` and `messages/fr.json` are missing: `URGENT_REVIEW`, `CLARIFY_SYMPTOMS`, `ASK_FOR_POSTCODE`, `ASK_HORSE_COUNT`, `MANUAL_CLASSIFICATION` triage classification labels; all invoice status enum tokens; `status.not_needed`.

**Finding 10 (date locale):** `app/[locale]/appointments/[id]/page.tsx` uses `new Date(x).toLocaleDateString()`, `.toLocaleTimeString()`, and `.toLocaleString()` with no locale argument — output is controlled by the OS/browser locale, not the active next-intl locale.

---

## §3 — PR plan

PRs are sequenced smallest-first within each phase. Each PR targets `main`. All PRs open as draft. Five non-negotiable checks must be green before each push:

```
npm run lint && npm run typecheck && npx prisma validate && npm run test && npm run build
```

---

### Phase 1 — Demo blockers
> Stop-gate: human approval required before merging PR-A and PR-B.

---

#### PR-A — fix/demo-sign-in-ux (size S)

**Branch:** `fix/demo-sign-in-ux`
**Files:** `app/[locale]/login/page.tsx`

**Problem:** The demo-vet card is a plain HTML `<form action="/api/demo/sign-in" method="POST">`. Any non-redirect response from the server produces a blank page with no user feedback. The login page is a server component and cannot hold client state.

**Fix:**
1. Extract the demo-vet card into a new `'use client'` component `DemoSignInButton` (inline in the same file or a sibling file under `components/auth/`).
2. Replace the `<form>` with a `<button onClick={handleDemoSignIn}>` that calls `fetch('/api/demo/sign-in', { method: 'POST', body: formData })`.
3. On success (res.ok or res.redirected), call `router.push('/${locale}/dashboard')` — read the locale from props passed down from the server component.
4. On failure, set an error string in local state and render it as an amber alert banner (same style as the existing `{error && ...}` block).
5. Show a loading spinner on the button while the fetch is in flight.

**Stop-gate:** surface PR URL to user and pause for explicit merge approval.

---

#### PR-B — fix/generate-routes-wiring (size S)

**Branch:** `fix/generate-routes-wiring`
**Files:** `app/[locale]/planning/page.tsx`

**Problem:** Line 86 in the planning page:
```tsx
<Button onClick={() => router.push('/route-runs')}>
  {t('generateRoutes')}
</Button>
```
This is navigation only. `app/api/route-planning/generate/route.ts` exists and is the correct target.

**Fix:**
1. Replace `router.push('/route-runs')` with a `fetch('/api/route-planning/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' } })` call.
2. Add `isGenerating` boolean state; disable the button and show a spinner while in flight.
3. On success (res.ok), refresh the route-runs list (trigger a re-fetch of the runs data already loaded on the page).
4. On failure, show an inline error message below the button.
5. If the endpoint returns a 202 (async job queued), show a "Route generation started — check back shortly" toast.

**Stop-gate:** surface PR URL to user and pause for explicit merge approval.

---

### Phase 2 — Operator UX
> Auto-merge after CI green (no human gate on PRs C–G).

---

#### PR-C — fix/seed-idempotency (size XS)

**Branch:** `fix/seed-idempotency`
**Files:** `prisma/seed-demo.ts`

**Problem:** Every `prisma.appointment.upsert` (and equivalent for enquiries, visit requests) has `update: {}`. Re-seeding the database after a demo session never restores mutated fields (status, notes, outcomes) to their intended demo values.

**Fix:** For every demo record upsert, populate the `update` block to mirror the `create` block — specifically the status, any outcome-related fields, and any fields the vet might change during a demo (cancellationReason, reminderSentAt, confirmationSentAt, visitOutcome). This makes `npx ts-node prisma/seed-demo.ts` fully idempotent.

**Auto-merge** after CI green.

---

#### PR-D — fix/triage-override-button (size XS)

**Branch:** `fix/triage-override-button`
**Files:** `app/[locale]/triage/page.tsx`

**Problem:** The override modal (lines 405–427) and its state/handler are implemented but no UI element opens it. Row actions (lines 376–397) have: Details, Request Info (conditional), Move to Planning Pool, Escalate, Mark Done — no Override.

**Fix:** Add an "Override" button to the row-actions block:
```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => setOverrideModal({ open: true, enquiryId: row.id })}
>
  {t('override')}
</Button>
```
Add translation key `triage.override` to `messages/en.json` ("Override") and `messages/fr.json` ("Modifier").

**Auto-merge** after CI green.

---

#### PR-E — fix/appt-channel-pill (size XS)

**Branch:** `fix/appt-channel-pill`
**Files:** `app/[locale]/appointments/[id]/page.tsx`

**Problem:** `confirmationChannel` (e.g. "WHATSAPP", "EMAIL") is present in the API response but never rendered on the appointment detail page.

**Fix:** In the Confirmation History card, add a channel indicator next to the "Confirmation sent" row:
```tsx
{appointment.confirmationChannel && (
  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
    {t(`channel.${appointment.confirmationChannel.toLowerCase()}`)}
  </span>
)}
```
Add `channel.whatsapp` and `channel.email` keys to both locale files.

**Auto-merge** after CI green.

---

#### PR-F — fix/mobile-nav-triage (size XS)

**Branch:** `fix/mobile-nav-triage`
**Files:** `components/layout/MobileNav.tsx`, `messages/en.json`, `messages/fr.json`

**Problem:** The fourth bottom-nav slot is hardcoded to `/customers` with a generic "more" label. Triage — the most frequently used screen for the vet — has no mobile nav shortcut.

**Fix:**
1. In `MobileNav.tsx`, replace the fourth slot with `{ key: 'triage', href: '/triage', icon: <TriageIcon> }` — reuse whichever icon the sidebar uses for triage (check `components/layout/Sidebar.tsx` for the icon import).
2. Add `nav.triage` key: `"Triage"` (EN) / `"Triage"` (FR — same word).
3. If a "More" overflow entry is still needed, it can be a fifth item or removed; Rachel did not flag any nav overflow as needed.

**Auto-merge** after CI green.

---

#### PR-G — fix/i18n-missing-keys (size S)

**Branch:** `fix/i18n-missing-keys`
**Files:** `messages/en.json`, `messages/fr.json`

**Problem:** The following keys are absent from both locale files, causing raw enum values to render as-is in the UI:

- Triage classification labels: `URGENT_REVIEW`, `CLARIFY_SYMPTOMS`, `ASK_FOR_POSTCODE`, `ASK_HORSE_COUNT`, `MANUAL_CLASSIFICATION`
- Invoice status tokens (check the Prisma `InvoiceStatus` enum for the full list)
- `status.not_needed`

**Fix:** Add every missing key under the appropriate namespace in both locale files. Use British English in EN. French translations must be correct equine/veterinary terminology.

Example additions to `messages/en.json`:
```json
"triage": {
  "classification": {
    "URGENT_REVIEW": "Urgent Review",
    "CLARIFY_SYMPTOMS": "Clarify Symptoms",
    "ASK_FOR_POSTCODE": "Ask for Postcode",
    "ASK_HORSE_COUNT": "Ask for Horse Count",
    "MANUAL_CLASSIFICATION": "Manual Classification"
  }
},
"invoice": {
  "status": {
    "NOT_INVOICED": "Not Invoiced",
    "INVOICED": "Invoiced",
    "PAID": "Paid",
    "OVERDUE": "Overdue",
    "CANCELLED": "Cancelled",
    "NOT_NEEDED": "Not Needed"
  }
},
"status": {
  "not_needed": "Not needed"
}
```

**Auto-merge** after CI green.

---

### Phase 3 — Polish
> Stop-gate: human approval required before merging PR-H.

---

#### PR-H — fix/date-locale-formatting (size M)

**Branch:** `fix/date-locale-formatting`
**Files:** `app/[locale]/appointments/[id]/page.tsx` + any other client pages with raw Date locale methods

**Problem:** Multiple pages use bare `new Date(x).toLocaleDateString()` / `.toLocaleTimeString()` / `.toLocaleString()` with no locale argument. These follow the OS/browser locale, not the active next-intl locale. A French operator sees dates in English if their browser is set to EN.

**Fix:**
1. In each affected client component, import and call `useFormatter()` from `next-intl`.
2. Replace `formatDate(x)` → `format.dateTime(new Date(x), { dateStyle: 'medium' })`.
3. Replace `formatTime(x)` → `format.dateTime(new Date(x), { timeStyle: 'short' })`.
4. Replace `formatDateTime(x)` → `format.dateTime(new Date(x), { dateStyle: 'medium', timeStyle: 'short' })`.
5. Audit: appointments list, enquiries, route-runs, customers, planning — find every `toLocaleDateString` / `toLocaleString` / `toLocaleTimeString` occurrence.

**Stop-gate:** surface PR URL to user and pause for explicit merge approval (touches multiple pages, regression risk).

---

## §4 — Out of scope

| Finding | Reason |
|---------|--------|
| 503 root cause (browser tool quirk) | Not a code bug; Perplexity tool misreports 303 as 503. No server-side change needed. |
| Native iOS/Android app | Phase 2+ only per CLAUDE.md architecture decision. PWA-first is correct. |
| Customer self-service portal | Out of scope for v1 — internal operational app first. |
| Route optimisation map view | Phase 2+ feature; route-runs list is sufficient for v1. |

---

## §5 — KNOWN_ISSUES diff

After each PR merges, update `docs/KNOWN_ISSUES.md`:

| Entry | Action |
|-------|--------|
| Seed drift: demo-appt-confirmed shows COMPLETED after demo session | Close (PR-C) |
| Override button not wired to modal in Triage page | Close (PR-D) |
| Date/time formatting uses browser locale, not active next-intl locale | Close (PR-H) — add as open issue until PR-H merges |
| Triage status enum labels render as raw values (no i18n) | Close (PR-G) |

---

## §6 — Overnight execution loop

The following loop drives all eight PRs autonomously. Human stop-gates are enforced at PR-A, PR-B, and PR-H before merge.

```
FOR each PR in [A, B, C, D, E, F, G, H]:

  STEP 1: Create branch
    git fetch origin main
    git checkout -b <branch> origin/main

  STEP 2: Apply code changes
    Edit files listed in §3 for this PR.

  STEP 3: Quality gate — repeat until green
    npm run lint
    npm run typecheck
    npx prisma validate
    npm run test
    npm run build
    IF any check fails → diagnose, fix, loop back.

  STEP 4: Commit
    git add <files>
    git commit -m "<concise message referencing PR letter and scope>"

  STEP 5: Push
    git push -u origin <branch>
    (retry up to 4× with exponential backoff on network error)

  STEP 6: Open draft PR
    mcp__github__create_pull_request(
      repo="rjk134/equismile",
      title="<title>",
      body="<body with test plan>",
      head="<branch>",
      base="main",
      draft=true
    )

  STEP 7: Subscribe to CI events
    mcp__github__subscribe_pr_activity(pr_number=<n>)

  STEP 8: Wait for CI
    On CI failure → read failure output, apply fix, commit, push (max 3 attempts).
    On CI green → proceed to STEP 9.

  STEP 9: Merge decision
    IF PR in [A, B, H]:
      PAUSE — post PR URL to user, wait for explicit "merge" instruction.
    ELSE (PR in [C, D, E, F, G]):
      mcp__github__merge_pull_request(pr_number=<n>, merge_method="squash")

  STEP 10: Sync main
    git checkout main
    git pull origin main

  PROCEED to next PR.
```

**Stop-gate PRs (do not merge without explicit human approval):**
- PR-A: `fix/demo-sign-in-ux` — sign-in flow change, investor demo path
- PR-B: `fix/generate-routes-wiring` — POSTs to a real API endpoint for the first time
- PR-H: `fix/date-locale-formatting` — touches multiple pages, regression risk

**Auto-merge PRs (merge when CI green):**
- PR-C, PR-D, PR-E, PR-F, PR-G

---

*End of UAT v1.1 Triage document.*
