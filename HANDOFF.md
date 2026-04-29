# EquiSmile Demo — iPhone Handoff Note

_Last updated: 2026-04-29 | Branch: `demo-mobile-fixes`_

## How to reach the demo

1. Run `DEMO.bat` (Windows) or `docker compose up` with `DEMO_MODE=true`.
2. Open `http://localhost:3000/en/login` and click **Continue as Demo Vet**.
3. Share the LAN/tunnel URL (e.g. via ngrok) to test on iPhone.

> **No public deploy yet.** The app is self-hosted via Docker; it has no
> Vercel / Railway config. To get a shareable demo URL, push the repo to
> Railway or Render and set the env vars from `.env.example` plus
> `DEMO_MODE=true`, `NEXTAUTH_SECRET`, and `DATABASE_URL`.

---

## ✅ Works on iPhone (tested at 375 px — iPhone SE / 14 viewport)

| Screen | Status | Notes |
|--------|--------|-------|
| `/login` | ✅ | Demo Vet button renders cleanly; locale redirect honours `/en/` vs `/fr/` |
| `/dashboard` | ✅ | Cards stack vertically; no overflow |
| `/customers` | ✅ | List scrolls, search bar usable |
| `/horses` | ✅ | Same as customers |
| `/yards` | ✅ | Same as customers |
| `/enquiries` | ✅ | Triage status chips fit on one line |
| `/visit-requests` | ✅ | Urgency + status filters display |
| `/appointments` | ✅ | Calendar list view renders |
| `/triage` | ✅ | Cards readable |
| `/privacy` + `/terms` | ✅ | Static prose, no layout issues |
| Soft-delete modal | ✅ | Confirmation dialog full-width, close on Escape fixed (Phase 16) |
| `/admin/observability` | ✅ | DLQ/audit/backup panels scroll |

---

## ⚠️ Caveats / Still needs work on iPhone

| Item | Severity | Detail |
|------|----------|--------|
| `/demo` — Data Counts grid | Fixed in this PR | Was `grid-cols-3 sm:grid-cols-7`, overflowed at 375 px. Now `grid-cols-2 sm:grid-cols-4`. |
| `/demo` — Full Day button label | Fixed in this PR | Long bilingual string clipped on xs. Now abbreviated to "Simulate Full Day" below `sm:` breakpoint. |
| `/demo` — infinite loading spinner | Fixed in this PR | `fetchStatus` had no timeout; now uses `AbortSignal.timeout(8 s)`. |
| `/demo` — action fetch hung indefinitely | Fixed in this PR | `runAction` had no timeout; now uses `AbortSignal.timeout(30 s)`. |
| `/planning` — route map | ⚠️ Caveat | Google Maps embed is desktop-oriented; pinch-zoom works but the map control buttons overlap the sidebar. `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` must be set — absent key shows a grey tile. |
| `/route-runs` — route detail map | ⚠️ Caveat | Same as planning; map controls overlap on narrow viewports. |
| PWA offline queue ordering | ⚠️ Caveat | KI-003: mutations queued while offline replay out-of-order on reconnect. Visible if you tap several actions quickly in airplane mode. |
| n8n workflow panel in `/admin` | ⚠️ Caveat | Requires `N8N_API_KEY` env var; without it, the workflow status cards show "unconfigured" — expected, but may confuse a demo viewer. |
| WhatsApp webhook | ℹ️ Info | KI-004: real WhatsApp intake requires a public URL (ngrok etc.). In demo mode the simulate buttons replace this. |

---

## Flows that were hanging / showing loading — root causes found

1. **`/demo` status endpoint** — `fetch('/api/demo/status')` had no signal/timeout.
   If the DB seed hadn't run, the request timed out at the OS level (~2 min),
   keeping the spinner visible the whole time. **Fixed: 8-second abort.**

2. **Full Day Workflow button** — six sequential API calls with no per-call timeout.
   If `generate-routes` stalled (n8n not configured), the button stayed in
   `running === 'full-day'` state with no escape. **Fixed: 30-second per-call abort.**

3. **`/api/setup` — 410 Gone** (Phase 16 slice 7) — any internal call to
   `POST /api/setup` now returns 410. Removed the stale reference from
   `runAction` calls. No UI button pointed at it, but it was an implicit
   risk in any operator-run script.

4. **`/api/status` n8n probe** (Phase 16 slice 2) — previously probed n8n
   even when `N8N_API_KEY` was unset, burning a 3 s timeout every poll.
   Already resolved upstream; documented here for completeness.

---

_Filed by: Perplexity AI assistant, 2026-04-29_
