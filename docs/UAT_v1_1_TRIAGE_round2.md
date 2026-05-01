# UAT v1.1 Triage — Round 2

**Triage date:** 2026-05-01
**Triage engineer:** Claude Code (post-UAT, round 2)
**UAT tester:** Dr. Rachel Kemp (Vet Operator persona)
**UAT verdict:** Not yet — sign-in 503 + missing live Maps block the demo journey
**Prior round:** [`docs/UAT_v1_1_TRIAGE.md`](./UAT_v1_1_TRIAGE.md) — closed by PRs #68–#75 (commits `edb87c0`…`8f6722b`)
**File-naming note:** the prior `UAT_v1_1_TRIAGE.md` is preserved. This round-2 document avoids clobbering it.

---

## §1 — What was tested

| Field | Detail |
|-------|--------|
| Date | 2026-04-30 (UAT walkthrough); 2026-05-01 (triage) |
| Tester persona | Dr. Rachel Kemp — equine dental vet, primary operator |
| Environment | localhost (no Pinggy tunnel provided in metadata); Chrome 930×1193 desktop, viewport stuck — could not emulate 390 px |
| Session tools | Perplexity browser automation (carry-over note from round 1: misreports 303 redirects as 503) |
| Build ref | **Not captured.** Rachel: "no repo access from browser." Multiple findings strongly imply a build pre-dating PRs #68–#75. |
| Scope | Sign-in → Dashboard → Enquiry detail → Triage → Planning → Generate → Route-run review → Appointment detail (EN+FR) → Completed visits → Bilingual; mobile (skipped, viewport stuck); offline (skipped) |

Rachel covered the eight beats from `docs/DEMO_RUNBOOK.md` §5 plus mobile/offline checks. She logged 14 findings (2 High, 7 Medium, 5 Low), declared "Not yet" overall.

**Critical context — build ambiguity.** Rachel did not record the build SHA. The previous round (`docs/UAT_v1_1_TRIAGE.md`) shipped PRs #68–#75 to address findings 1, 3, 5, 6, 7, 8, 9, 10 from that round. Several round-2 findings re-report the same symptoms even though the code on `main@8f6722b` clearly contains the fixes. The audit below distinguishes confirmed-on-HEAD code bugs (real follow-ups) from stale-build / operator-hygiene / tool-quirk findings (no PR needed, requires retest with the build SHA captured).

---

## §2 — Confirmed gaps after audit

Each finding is classified per the framework in CLAUDE.md (this triage's controlling brief): **Demo-blocker/High → Phase 1**, **Operator-UX/Medium → Phase 2**, **Polish/Low → KI entry**, **Out-of-scope** or **Already-covered**.

| # | Rachel's words (paraphrased) | Bucket | Severity | Why it matters | Size | Phase |
|---|---|---|---|---|---|---|
| 1 | "POST /api/demo/sign-in returns 503; button gives no feedback" | **Already-covered + defensive harden** | High (perceived) | Sign-in code on HEAD has loading state + amber error banner (PR #68, `components/auth/DemoSignInButton.tsx`). The "503" is most likely the Perplexity tool re-reporting the 303 redirect as 503 (same quirk noted in round 1, finding #11). Rachel's "zero feedback" claim is inconsistent with the shipped code — strongly suggests stale build. To kill this entire false-alarm class, we can convert the endpoint to `200 + JSON {ok:true, redirectTo}` so no 303 is emitted. | S | 2 |
| 2 | "Generate Routes does nothing, no googleapis call, map shows 'API key not configured'" | **Operator-UX + runbook drift** | High (perceived) | Code on HEAD: button correctly POSTs `/api/route-planning/generate` (PR #69, `app/[locale]/planning/page.tsx:45`). The visible failure is the **operator did not set the three Google Maps env vars** (`GOOGLE_MAPS_API_KEY`, `GCP_PROJECT_ID`, `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`) per `DEMO_RUNBOOK.md` §1. The app falls back silently to nearest-neighbour + a "Route Map (API key not configured)" placeholder — too quiet for the persona who is told the live-Maps differentiator is the demo's #1 cheer. **Smallest viable fix: a banner when `EQUISMILE_LIVE_MAPS=true` is set but any of the three keys is missing**, plus a `DEMO_RUNBOOK` pre-flight that runs `/api/health` and refuses to proceed with `googleMaps.status: 'unconfigured'`. Trust Rachel's word that the differentiator is undemonstrable. | S | 2 |
| 3 | "No Override button on the triage row" | **Already-covered + clarity polish** | Medium | Button shipped at `app/[locale]/triage/page.tsx:394–396` (PR #71). Rendered as `variant="ghost"` (lower visual weight than the `secondary` siblings — Move/Escalate/Mark Done). Rachel's persona priority is *speed > clarity*. If she scanned the row and missed it because it didn't look like a peer of the others, the Override is effectively invisible. Smallest fix: bump Override to `variant="secondary"` so it has equal weight. | XS | 2 |
| 4 | "Approve/Reject not present on route-run detail; static map" | **Already-covered (intentional)** | Medium | `app/[locale]/route-runs/[id]/page.tsx:207` correctly conditions Approve/Reject on `status === 'DRAFT' \|\| 'PROPOSED'`. Rachel opened `demo-route-approved` which is `BOOKED` — by design, no Approve/Reject. Static map is the same root cause as Finding 2. No PR for the buttons. | — | — |
| 5 | "Cancel/Reschedule absent on appointment; channel pill missing" | **Already-covered (operator hygiene)** | Medium | Cancel/Reschedule buttons render only when `isActive = status === 'PROPOSED' \|\| 'CONFIRMED'` (`app/[locale]/appointments/[id]/page.tsx:169`). Channel pill renders when `confirmationChannel != null` (PR #72, lines 272–276). Rachel saw `demo-appt-confirmed` showing **Completed** — that's because her prior demo session completed it, **and the operator did not re-run `npm run db:seed-demo` before the UAT walkthrough**. PR #70 (`prisma/seed-demo.ts:909–916`) populates the update block to reset status → CONFIRMED + channel → WHATSAPP on re-seed. No PR; retest after re-seeding. | — | — |
| 6 | "Date M/D/YYYY and 12-h time on /fr" | **Already-covered (build verify)** | Medium | PR #75 (`8f6722b`) replaced bare `toLocaleDateString` / `toLocaleTimeString` with `useFormatter().dateTime()` across **12 client pages** including dashboard, completed, appointments, enquiries, route-runs, customers, horses. `grep` on HEAD confirms zero remaining bare `toLocale*` calls under `app/[locale]/`. Rachel's M/D/YYYY observation is the pre-PR-#75 format. Almost certainly stale build. | — | — |
| 7 | "Status enums shown as raw uppercase keys (URGENT_REVIEW etc.) on /fr/dashboard" | **Confirmed code bug** | Medium | **REAL bug on HEAD.** `app/[locale]/dashboard/page.tsx:236` renders `{task.taskType}` raw — `URGENT_REVIEW`, `CLARIFY_SYMPTOMS`, etc. PR #74 added the i18n keys but the dashboard's "Triage Tasks" panel was not updated to use them. The `triage` page itself maps via `taskTypeLabel(...)` and `t(...)` correctly. This is a real follow-up. | XS | 2 |
| 8 | "`status.not_needed` raw key in Completed Visits invoice column" | **Already-covered (build verify)** | Medium | PR #74 (`50834cd`) added `status.not_needed`, `status.pending`, `status.sent`, `status.paid` to both EN and FR. `StatusBadge` falls through to `status.${value.toLowerCase()}` for InvoiceStatus values — works on HEAD. The literal `status.not_needed` Rachel saw is the next-intl key-path fallback when the key is absent — i.e. a build pre-#74. Stale build. | — | — |
| 9 | "Triage absent from mobile bottom nav; 'More' lands on Customers" | **Already-covered (build verify)** | Medium | `components/layout/MobileNav.tsx:6–11` has Triage as the 4th slot (PR #73, `26146d1`). Rachel's "More → Customers" observation is the pre-PR-#73 state. Definitively stale build. | — | — |
| 10 | "Mixed locale on EN enquiry detail: subtitle FR, page chrome EN" | **Polish (intentional)** | Low | The subtitle (`"Urgence — Mistral ne mange plus"`) is the customer's enquiry text, which stays in its source language. Page chrome is i18n. This is correct — translating customer text would lose evidential fidelity. Cosmetic at most. KI entry only. | — | KI |
| 11 | "'1hrs 5min' — pluralisation" | **Polish** | Low | `app/[locale]/route-runs/[id]/page.tsx:109` uses `${hrs}${t('hrs')}` — no ICU plural. Cosmetic. KI entry; can fix opportunistically. | XS | KI / opportunistic |
| 12 | "demo-appt-completed lacks outcome / clinical-notes block" | **Confirmed seed gap** | Low | `prisma/seed-demo.ts` has **no `prisma.visitOutcome.upsert`** anywhere. `demo-appt-completed` (status COMPLETED) has no linked VisitOutcome row, so the Completed Visits page renders "-" for notes/follow-up. Real seed gap. Smallest fix: add a single VisitOutcome upsert for `demo-appt-completed`. | XS | 2 |
| 13 | "Background prefetches return many 503s for `?_rsc=…` payloads" | **Polish (investigation)** | Low | Likely a Pinggy/Perplexity-tool quirk on RSC payload prefetches (no Pinggy tunnel in this session — but the symptom matches tunnel + 303-on-redirect). Not reproducible without more metadata. KI entry; investigate if it recurs in a controlled retest. | — | KI |
| 14 | "frontend-cdn.perplexity.ai font 503" | **Out of scope** | Low | This is the Perplexity browser tool's own asset failing to load. Not EquiSmile. No action. | — | — |

### Bonus runbook & seed drift surfaced incidentally

| Issue | Source | Severity | Size |
|---|---|---|---|
| `DEMO_RUNBOOK.md` §5 beat 2 names "Sophie Dupuis (FR — `demo-enquiry-03`)" | Seed has Pierre Rochat (`prisma/seed-demo.ts:91`). Mistral, Bramble, Shadow, Sarah Mitchell are accurate; Sophie does not exist. | Low (operator confusion) | XS |
| Build-SHA not captured by tester | The entire "is this a real bug or stale build?" ambiguity above could be defanged with a `process.env.NEXT_PUBLIC_BUILD_SHA` rendered in the login footer when `DEMO_MODE=true`. | Operator-UX / Low | XS |

### Summary of what's actually broken on HEAD `8f6722b`

After audit:
- **1 real code bug** (Finding 7 — dashboard renders raw `task.taskType`).
- **1 real seed gap** (Finding 12 — no VisitOutcome for `demo-appt-completed`).
- **2 operator-UX hardenings worth doing** (Finding 1 demo sign-in 200+JSON; Finding 2 Maps-config banner).
- **1 polish/clarity nudge** (Finding 3 — Override button visual weight).
- **1 documentation drift** (DEMO_RUNBOOK Sophie Dupuis ⇒ Pierre Rochat).
- **1 operational improvement** (build-SHA badge so future UAT can be self-diagnosing).
- **Everything else** is stale-build, operator hygiene, tool quirk, intentional behaviour, or out of scope.

**Verdict against the persona's "Tuesday morning" test**: the iPhone-via-Pinggy demo path documented in `DEMO_RUNBOOK.md` §2 will work end-to-end provided the operator follows the runbook. The risks are: (a) operator skips re-seed before showtime, (b) operator doesn't set the three Google Maps keys. Both are runbook-compliance issues. Hardening recommendation in §3.

---

## §3 — PR plan

Sequential, draft, smallest-first within each phase. Each PR targets `main`. All PRs open as draft. Five non-negotiable checks must be green locally before push:

```
npm run lint && npm run typecheck && npx prisma validate && npm run test && npm run build
```

Stub `DATABASE_URL=postgresql://test:test@localhost:5432/test` for `prisma validate` per project convention.

### Phase 1 — Confirmed demo-blockers

**None on HEAD.** Rachel's two High findings (1, 2) are not real demo-blockers in the deployed code; they map to operator-hygiene and runbook-compliance gaps that Phase 2 hardens. The walkthrough audit shows no genuine code-blockers on `8f6722b`.

> Stop-gate: human approval of this analysis before any Phase 2 work proceeds.

### Phase 2 — Operator UX

Sized smallest-first. Each PR is independently revertible.

---

#### PR-1 — `fix/dashboard-tasktype-i18n` (size XS)

**Branch:** `fix/dashboard-tasktype-i18n`
**Files:** `app/[locale]/dashboard/page.tsx` (one file, ~6 lines)
**Closes:** Finding 7 (real code bug).

**Scope:** Dashboard "Triage Tasks" panel renders raw enum values (`URGENT_REVIEW`, `CLARIFY_SYMPTOMS`, …) instead of i18n-translated labels. Triage page does this correctly via `taskTypeLabel(...)` + `t(...)`.

**Files touched:** `app/[locale]/dashboard/page.tsx`.

**Change shape:**
1. Add `const tt = useTranslations('triage')` inside `DashboardPage`.
2. Add the same `taskTypeLabel(taskType: string)` map present in `triage/page.tsx:184–193`.
3. At line 236, replace `{task.taskType}` with `{tt(taskTypeLabel(task.taskType))}`.

**Risk:** Negligible. Adds one translation lookup; keys already exist for all five enum values per PR-G/PR #74's pattern.

**Verification:** `npm run lint && npm run typecheck && npm run test && npm run build` green. Manual: open `/fr/dashboard` with seeded triage tasks and confirm the panel shows "Examen urgent" / "Clarifier les symptômes" rather than `URGENT_REVIEW` / `CLARIFY_SYMPTOMS`.

---

#### PR-2 — `fix/seed-visit-outcome-completed` (size XS)

**Branch:** `fix/seed-visit-outcome-completed`
**Files:** `prisma/seed-demo.ts` (one file, ~15 lines).
**Closes:** Finding 12 (real seed gap).

**Scope:** `demo-appt-completed` has no linked `VisitOutcome` row, so the Completed Visits page and the appointment detail page show empty outcome blocks for the one completed appointment in the demo. Closes the loop demanded by `DEMO_RUNBOOK.md` §5 beat 8.

**Files touched:** `prisma/seed-demo.ts` only.

**Change shape:**
After the `demo-appt-completed` upsert (around line 970), add:

```ts
await prisma.visitOutcome.upsert({
  where: { id: 'demo-outcome-completed' },
  update: {
    notes: 'Routine dental check — mild hooks on 107/207 rasped. Sedation: detomidine 5mg IV.',
    followUpRequired: false,
    nextDentalDueDate: new Date('2026-10-10T00:00:00Z'),
    invoiceStatus: 'NOT_NEEDED',
  },
  create: {
    id: 'demo-outcome-completed',
    appointmentId: 'demo-appt-completed',
    completedAt: new Date('2026-04-10T10:30:00Z'),
    notes: 'Routine dental check — mild hooks on 107/207 rasped. Sedation: detomidine 5mg IV.',
    followUpRequired: false,
    nextDentalDueDate: new Date('2026-10-10T00:00:00Z'),
    invoiceStatus: 'NOT_NEEDED',
  },
});
```

(Final fields confirmed against `prisma/schema.prisma` `VisitOutcome` model before commit.)

**Risk:** Seed-only. No schema change. Idempotent via upsert.

**Verification:** `npm run db:seed-demo`, open `/en/completed`, confirm `demo-appt-completed` row shows clinical notes; open `/en/appointments/demo-appt-completed`, confirm the Visit Outcome card renders.

---

#### PR-3 — `fix/triage-override-prominence` (size XS)

**Branch:** `fix/triage-override-prominence`
**Files:** `app/[locale]/triage/page.tsx` (one line).
**Closes:** Finding 3 visibility concern (build-verify caveat).

**Scope:** Override button is visually de-prioritised vs its row peers (Move to Planning Pool, Escalate, Mark Done are all `variant="secondary"`; Override is `variant="ghost"`). Persona priority *speed > clarity* — ghost weight makes it scan-skippable. PR-D/PR #71 shipped the function; this is the polish finishing line.

**Files touched:** `app/[locale]/triage/page.tsx:394`.

**Change shape:** Change `<Button size="sm" variant="ghost" onClick={() => setOverrideModal(...)}>` to `<Button size="sm" variant="secondary" ...>`. One token change.

**Risk:** Cosmetic only. No new keys, no behaviour change.

**Verification:** Standard five-check. Manual: open `/en/triage`, confirm Override has the same weight as Move/Escalate/Mark Done.

---

#### PR-4 — `fix/seed-runbook-naming` (size XS)

**Branch:** `fix/seed-runbook-naming`
**Files:** `docs/DEMO_RUNBOOK.md` only.
**Closes:** Operator runbook drift (incidentally surfaced).

**Scope:** `DEMO_RUNBOOK.md` §5 beat 2 names "Sophie Dupuis (FR — `demo-enquiry-03`)" and beat 6 says "Villeneuve→Aigle". The seed has Pierre Rochat as the FR customer for `demo-enquiry-03` and the route name is "Écurie du Lac → Haras de l'Aigle" (Écurie du Lac is in Villeneuve, geographically right; naming differs).

**Files touched:** `docs/DEMO_RUNBOOK.md` §5 beat 2, beat 6.

**Change shape:** Update narrative to match seed:
- Beat 2: "Open the Mistral case (Pierre Rochat, FR — `demo-enquiry-03`)."
- Beat 6: "Open the pre-seeded `APPROVED` Écurie du Lac → Haras de l'Aigle run (`demo-route-approved`)."

**Risk:** Documentation only. Reduces operator confusion during showtime.

**Verification:** `npm run lint` runs (markdown ignored). Manual: confirm runbook reads consistently with `prisma/seed-demo.ts` line 91 + line 638.

---

#### PR-5 — `feat/demo-maps-banner` (size S)

**Branch:** `feat/demo-maps-banner`
**Files:** new `components/demo/DemoMapsConfigBanner.tsx`; `app/[locale]/dashboard/page.tsx`; `messages/en.json` + `messages/fr.json`; (optionally `app/[locale]/route-runs/[id]/page.tsx`).
**Closes:** Finding 2 (operator-UX harden).

**Scope:** When `DEMO_MODE=true` and `EQUISMILE_LIVE_MAPS=true` is requested but any of `GOOGLE_MAPS_API_KEY` / `GCP_PROJECT_ID` / `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is absent, render an amber banner above the dashboard fold pointing the operator at `DEMO_RUNBOOK.md` §2. Defensive — closes the silent fallback that made Rachel say "the live-Google differentiator is not demonstrable".

**Files touched:**
- `app/api/demo/status/route.ts` (already exists; extend response with `maps.live`, `maps.missingKeys[]`).
- `components/demo/DemoMapsConfigBanner.tsx` (new, client component, fetches `/api/demo/status` on mount, renders amber alert when `maps.live === false && demoLiveMapsRequested === true`).
- `app/[locale]/dashboard/page.tsx` — render `<DemoMapsConfigBanner />` above the counters.
- `messages/{en,fr}.json` — `demo.mapsBanner.title`, `demo.mapsBanner.body`, `demo.mapsBanner.runbook`.

**Risk:** New client component + one new API field. Demo-mode-only render gate (component returns null when `DEMO_MODE !== 'true'` confirmed by status response). No production-facing change.

**Verification:**
1. `EQUISMILE_LIVE_MAPS=true` + all three keys → banner does NOT render.
2. `EQUISMILE_LIVE_MAPS=true` + any key missing → banner renders with the missing key names.
3. `EQUISMILE_LIVE_MAPS` unset → banner does NOT render (operator opted out of live).
4. Production (`DEMO_MODE !== 'true'`) → banner does NOT render.
5. Unit tests for the banner's render gate against the four state combinations.

---

#### PR-6 — `feat/demo-sign-in-200-json` (size S)

**Branch:** `feat/demo-sign-in-200-json`
**Files:** `app/api/demo/sign-in/route.ts`, `components/auth/DemoSignInButton.tsx`, `__tests__/unit/api/demo-sign-in.test.ts`.
**Closes:** Finding 1 (defensive harden against the Perplexity 303→503 misreport class).

**Scope:** Convert `/api/demo/sign-in` from `303 redirect` to `200 OK + JSON {ok:true, redirectTo:'/{locale}/dashboard'}`, with the cookie set on the response. Update `DemoSignInButton` to read `redirectTo` from the JSON and `router.push(...)` it. Removes the 3xx → silent-tool-misreport-as-503 class entirely. Cookie semantics unchanged.

**Files touched:**
- `app/api/demo/sign-in/route.ts:87–94` — replace `NextResponse.redirect(... , 303)` with `NextResponse.json({ ok: true, redirectTo: ... }, { status: 200 })` while keeping the `response.cookies.set('authjs.session-token', ...)` call. **Hard-block outside `DEMO_MODE` retained.**
- `components/auth/DemoSignInButton.tsx:22–32` — on `res.ok`, read JSON, push to `data.redirectTo`. Fall back to existing `callbackUrl ?? /{locale}/dashboard` if missing.
- New test in `__tests__/unit/api/demo-sign-in.test.ts` — DEMO_MODE on returns 200+JSON+cookie; DEMO_MODE off returns 404; locale allow-list still enforced.

**Risk:** Endpoint contract change. Auth flow change. Demo-mode-only — no production blast radius. Verified by:
1. Existing demo-mode tests pass after update.
2. Cookie name + expiry + flags match prior `NextResponse.redirect` behaviour.
3. Manual: tap Demo Vet on `/en/login` → land on `/en/dashboard` with session.

**Stop-gate:** Surface PR URL to user and pause for explicit merge approval. Auth path → review-bot worth.

---

#### PR-7 — `feat/build-sha-footer` (size XS)

**Branch:** `feat/build-sha-footer`
**Files:** `app/[locale]/login/page.tsx`, `next.config.ts` (or build-sha env injection), `messages/{en,fr}.json`, possibly `Dockerfile` for the build-arg.
**Closes:** the entire "did Rachel test the right build?" diagnostic gap.

**Scope:** Inject the deployed git SHA at build time as `NEXT_PUBLIC_BUILD_SHA`; render the short SHA in the login-page footer (and `/api/demo/status` response) when `DEMO_MODE=true`. Future UAT testers can record "tested on build `8f6722b`" in their report metadata without leaving the page.

**Files touched:**
- `next.config.ts` — read `process.env.GIT_SHA` (set by CI/Dockerfile) into `env.NEXT_PUBLIC_BUILD_SHA`. Default to `'dev'` when unset.
- `Dockerfile` — accept `GIT_SHA` as an `ARG`, propagate to `ENV` for the build stage. CI populates from `${{ github.sha }}` (already on the workflow context).
- `app/[locale]/login/page.tsx:69–78` — append `<p className="text-xs text-gray-400">build {process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0,7) ?? 'dev'}</p>` inside the footer when `demoMode` is true.
- `messages/{en,fr}.json` — `auth.buildLabel`.

**Risk:** Tiny. Build-only env var. No runtime behaviour change.

**Verification:** `docker build --build-arg GIT_SHA=$(git rev-parse HEAD) .`; open `/en/login`; confirm short SHA visible. Manual: future tester quotes `8f6722b` directly in their UAT metadata.

---

### Optional / opportunistic (not part of the recommended sequence)

- **PR-8 — `fix/route-run-hours-plural`** (XS) — ICU plural for hr/hrs in `formatMinutes` of `app/[locale]/route-runs/[id]/page.tsx:104–110`. Closes Finding 11. Cosmetic.
- **PR-9 — `chore/statusbadge-invoice-type`** (XS) — Add an explicit `invoice` type to `StatusBadge` so `completed/page.tsx:224` can stop abusing `type="planning"` for `invoiceStatus` values. No functional change; tightens types. Closes Finding 8 latent fragility.

These are not recommended for the round-2 sequence — they're typing/cosmetic cleanup that can ship alongside any future change to those files.

### Sequence rationale

Smallest-first: PR-1 (XS) → PR-2 (XS) → PR-3 (XS) → PR-4 (XS) → PR-5 (S) → PR-6 (S) → PR-7 (XS).

PR-7 (build-SHA badge) is sequenced last only because it's the lowest-impact fix; it could equally well ship first to defang future UAT triage rounds.

PR-6 (demo sign-in contract change) is the only PR with a stop-gate at merge time. All others auto-merge after CI green per the prior round's pattern.

---

## §4 — Out of scope

| Item | Bucket | Rationale |
|---|---|---|
| Finding 14 — Perplexity tool font 503 | Tooling | `frontend-cdn.perplexity.ai` is the browser tool's own asset, not EquiSmile. No action. |
| Native iOS/Android UAT viewport at 390 px (Rachel's section 11) | Phase 2+ per CLAUDE.md | The PWA is responsive and the runbook is iPhone-Safari + Pinggy. Rachel's automation tool couldn't emulate 390 px. Real iPhone retest (the runbook's actual demo target) is the verification path; we don't need a code change. |
| Offline test (Rachel's section 12) | Tooling | Browser tool can't toggle offline. KI-003 was closed in v1.1 by the offline-queue sequence fix; behaviour stable per `lib/offline/queue-replay.ts` test suite. |
| Sophie/Pierre — re-seed to use Sophie Dupuis instead of Pierre Rochat | Out of scope (would widen) | The seed and runbook drifted; PR-4 fixes the **runbook**, not the seed. Renaming seed records is a wider blast radius (test fixtures, screenshots, prior triage doc references) for a low-value gain. |
| Pierre Rochat is at "Haras de l'Aigle" but Rachel saw a 14d-overdue badge instead of "1 h ago" | Seed (intentional) | Seed line 1024: `dueAt: new Date(Date.now() - 3600000)` — i.e. 1 hour ago. Rachel's "14d (Overdue)" output suggests a stale DB or different time source. Re-seed should fix; no PR. |
| Native `@sentry/nextjs`, customer self-service portal, additional SSO providers | Phase 2+ per CLAUDE.md | Not requested in Rachel's report; not in v1.1 readiness scope. |

---

## §5 — Updates to `KNOWN_ISSUES.md`

Proposed exact diff lines. Append to the **Active Issues** table:

```diff
 | KI-007 | 14 | Info | In-memory rate limiters (`lib/utils/rate-limit.ts`) do not share state across horizontally-scaled instances. Acceptable for the single-vet single-VPS deploy shape; promote to Redis when the deploy goes multi-node. | No action required for v1 scale. |
+| KI-008 | 8 | Low | Demo seed (`prisma/seed-demo.ts`) has no `VisitOutcome` records. `demo-appt-completed` shows status COMPLETED but with empty clinical-notes / follow-up / next-due fields, breaking the closed-loop demo narrative in `DEMO_RUNBOOK.md` §5 beat 8. | Resolved by round-2 PR-2 (`fix/seed-visit-outcome-completed`). |
+| KI-009 | 1 | Low | Mixed-locale enquiry detail subtitle: customer enquiry text stays in source language (e.g. FR text on `/en/enquiries/{id}`), while page chrome is in the active locale. Intentional — translating customer text would lose evidential fidelity — but the persona reported it as visual noise. | No action; design decision documented here. |
+| KI-010 | 5 | Low | Route-run summary uses `${hrs}${t('hrs')}` for duration — no ICU plural ("1hrs 5min" should be "1hr 5min"). Cosmetic. | Opportunistic fix in `fix/route-run-hours-plural`. |
+| KI-011 | 9 | Low | UAT testers using browser-automation tools (e.g. Perplexity) on a Pinggy tunnel may see RSC payload prefetches (`?_rsc=…`) reported as 503. Not reproducible against real browsers; investigation pending. | Recommend native browser (Chrome/Safari) for retest; tunnel-tool 5xx noise can be filtered. |
+| KI-012 | 8 | Low | StatusBadge `type="planning"` is reused for `InvoiceStatus` values via the fall-through lookup pattern (`status.${value.toLowerCase()}`). Works correctly post-PR #74 but conceptually misuses the type. | Opportunistic fix in `chore/statusbadge-invoice-type`. |
+| KI-013 | 9 | Info | UAT testers cannot capture the deployed build SHA from the running app, leading to ambiguous "is this a real bug or stale build?" triage. | Resolved by round-2 PR-7 (`feat/build-sha-footer`). |
```

(IDs continue from the existing KI-001..007 series. The existing AMBER series is untouched — round 2 surfaced no new AMBERs.)

---

## §6 — Operational notes for the retest

Before declaring any of the "build-verify" findings (1, 3, 5, 6, 8, 9) closed, the operator should:

1. **Capture the build SHA.** Either ship PR-7 first, or `git rev-parse HEAD` and record in the report metadata.
2. **Re-seed before each UAT session.** `npm run db:seed-demo`. PR #70 made the seed idempotent; running it resets `demo-appt-confirmed` to CONFIRMED + WHATSAPP and the urgent triage task to "1 h ago".
3. **Run `/api/health` from the test device.** Confirm `database.status: 'up'`, `googleMaps.status: 'configured'`. If `unconfigured`, either set the three env keys per `DEMO_RUNBOOK.md` §2 or unset `EQUISMILE_LIVE_MAPS`.
4. **Test on real Safari/Chrome.** The Perplexity browser-automation tool's 303→503 misreport is a known carry-over from round 1; real browsers don't have this quirk.
5. **Capture viewport at 390 px** via Chrome DevTools device toolbar rather than `resize_window`. Rachel's tool reported success on the resize but `window.innerWidth` stayed at 930.

---

*End of UAT v1.1 round-2 triage. Awaiting human approval before any PR work.*
