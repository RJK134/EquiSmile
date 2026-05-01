# EquiSmile — Demo Runbook

Operator-facing runbook for showing EquiSmile to a client. Targets an
iPhone session reaching a developer laptop via a Pinggy HTTPS tunnel.
WhatsApp and email are simulated (so no real customer messages can
escape mid-walkthrough); Google Maps is live (so the client sees a
real geocode + route-optimisation result).

For installation see [SETUP.md](./SETUP.md). For day-to-day operations
see [OPERATIONS.md](./OPERATIONS.md). For the recovery side of demo
mode see the demo-mode runtime gate documented in
[ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. Pre-flight checklist

Before the client arrives:

- [ ] Google Cloud credentials available:
      `GOOGLE_MAPS_API_KEY` (server-side), `GCP_PROJECT_ID`,
      `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` (browser-side).
      All three are needed: the server key drives Geocoding + Route
      Optimization, the project ID is mandatory for `optimizeTours`,
      the browser key renders the map tiles in `RouteMap`.
- [ ] Pinggy tunnel URL ready (one-time:
      `ssh -p 443 -R0:localhost:3000 a.pinggy.io` — copy the
      `https://<sub>.pinggy.io` URL it prints).
- [ ] Database is up and seeded:
      ```sh
      docker compose up -d
      npm run db:seed-demo
      ```
- [ ] Local dev server can start cleanly:
      ```sh
      npm run dev
      ```
- [ ] iPhone is on the same network or on cellular — Pinggy is public,
      so either works; cellular is safer for a client demo because
      it's independent of venue Wi-Fi.

## 2. Demo `.env.local`

Paste this block into `.env.local` (overrides `.env`). Replace the
three Google placeholders + the tunnel URL with the real values.

```
DEMO_MODE=true
EQUISMILE_LIVE_MAPS=true

NEXT_PUBLIC_APP_URL=https://<your-tunnel>.pinggy.io
AUTH_URL=https://<your-tunnel>.pinggy.io

GOOGLE_MAPS_API_KEY=AIza...your-server-key
GCP_PROJECT_ID=your-project-id
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=AIza...your-browser-key
```

What each line does:

| Var | Why it matters for the demo |
|---|---|
| `DEMO_MODE=true` | Enables `/api/demo/sign-in` (the one-tap Demo Vet shortcut), keeps WhatsApp + email simulated, and shows the demo-vet card on the login page. |
| `EQUISMILE_LIVE_MAPS=true` | Override that forces Google Maps to call the real Geocoding + `optimizeTours` APIs even while `DEMO_MODE=true`. WhatsApp and email stay simulated. |
| `NEXT_PUBLIC_APP_URL` | Default origin for the CORS allow-list. The iPhone's `Origin` header (the Pinggy URL) only passes the `/api/*` allow-list when this matches. |
| `AUTH_URL` | Tells Auth.js to trust the tunnel host. Without it, sign-in callbacks would mismatch and reject. |
| `GOOGLE_MAPS_*` + `GCP_PROJECT_ID` | Required by the live Google paths; without them `EQUISMILE_LIVE_MAPS=true` defensively falls back to demo/simulator mode. Verify the effective mode in the browser devtools console (not the server terminal): with missing credentials expect `[GoogleMaps] Client mode: demo`; with valid live credentials expect `live`. |

## 3. Reset and rehearse

The seed is idempotent (every row is `upsert`-ed on a stable id).
Re-run between rehearsals to wipe demo edits:

```sh
npm run db:seed-demo
```

Start the app:

```sh
npm run dev
```

Verify the tunnel is up by opening
`https://<tunnel>.pinggy.io/api/health` on the iPhone — the JSON
response should show `checks.database.status: 'up'` and
`checks.googleMaps.status: 'configured'`.

## 4. Sign-in shortcut

On the iPhone, open `https://<tunnel>.pinggy.io/en/login`. Tap the
**"Continue as Demo Vet"** card. Auth.js sets `authjs.session-token`
and you land on `/en/dashboard` already signed in as an admin.

If the demo-vet card doesn't appear, `DEMO_MODE` is not set to `true`
in the running process — re-check `.env.local`, restart `npm run dev`.

## 5. Walkthrough script (eight beats, ~15 minutes)

Each beat names the seeded fixture you should interact with so you
never hit an empty list. All fixtures are in `prisma/seed-demo.ts`.

1. **Dashboard** (`/en/dashboard`).
   Headline metrics: urgent count, needs-info, planning pool.
   "*One overdue urgent case is sitting at the top — the triage queue
   surfaces it the moment a customer reports a horse not eating.*"

2. **Enquiries** (`/en/enquiries`).
   Open the Mistral case (Pierre Rochat, FR — `demo-enquiry-03`).
   "*WhatsApp came in in French at 6 a.m. We auto-translated, parsed
   the urgency cue, and routed it straight to triage.*"

3. **Triage** (`/en/triage`).
   The same Mistral task is `URGENT_REVIEW`, due 1 h ago for visual
   urgency. Show the audit trail and the override action.

4. **Planning pool** (`/en/planning`).
   Sarah Mitchell's routine request (`demo-enquiry-02`, two horses
   Bramble + Shadow) is in the pool. Show area-grouped yards.

5. **Route proposal generation**.
   From planning, trigger a fresh route generation across the seeded
   yard cluster. Because `EQUISMILE_LIVE_MAPS=true`, this hits the
   real Google `optimizeTours` API. Watch the network tab in dev tools
   to confirm.

6. **Route-run review** (`/en/route-runs`).
   Open the pre-seeded `APPROVED` Écurie du Lac (Villeneuve) → Haras
   de l'Aigle (Aigle) run (`demo-route-approved`). Show the map
   (`RouteMap` component), stop sequence, total distance.

7. **Appointments** (`/en/appointments`).
   `demo-appt-confirmed` — 6 May 2026 08:30, confirmation channel
   WhatsApp. Show the bilingual confirmation template.

8. **Completed visits** (`/en/completed`).
   `demo-appt-completed` shows the closed-loop flow: outcome notes,
   follow-up flag, invoice status. Closes the operator narrative.

## 6. During the demo — mobile sanity

The PWA is mobile-first; check at iPhone width before the client
session:

- All eight pages render without horizontal scroll at 390 px.
- Bottom nav (`MobileNav`) is reachable behind the iOS safe-area
  inset.
- The `RouteMap` panel resizes to viewport width on the route-run
  detail page.
- Mistral's overdue badge is visible above the fold on the dashboard
  card.

Anything broken on this checklist → punch list before showtime, not
during.

## 7. Post-demo cleanup

1. `Ctrl-C` the `npm run dev` process and tear down the Pinggy tunnel.
2. Unset `EQUISMILE_LIVE_MAPS` in `.env.local`. Leaving it on means
   any subsequent `npm run dev` invocation will burn live Google API
   spend on every test request.
3. Optional: `npm run db:seed-demo` once more so the next operator
   starts from a known state.

## 8. Failure modes the operator might hit

| Symptom | Cause | Fix |
|---|---|---|
| `/api/health` shows `checks.googleMaps.status: 'unconfigured'` on the iPhone | `GOOGLE_MAPS_API_KEY` missing or pointed at a key without Geocoding/Route Optimization enabled | Re-check the GCP console; both APIs must be enabled on the same project as `GCP_PROJECT_ID`. |
| Demo-vet card not visible | `DEMO_MODE` not loaded — usually a stale dev server | Restart `npm run dev` after editing `.env.local`. |
| iPhone says "this site can't be reached" | Pinggy tunnel timed out (free tier rotates URLs every 60 min) | Re-run the `ssh -p 443 …` command, copy the new URL into `NEXT_PUBLIC_APP_URL` + `AUTH_URL`, restart the dev server. |
| Sign-in lands on `/en/login` instead of `/en/dashboard` | `AUTH_URL` not set, so Auth.js refused to set the cookie on the tunnel host | Set `AUTH_URL` to the same origin as `NEXT_PUBLIC_APP_URL` and restart. |
| Route generation hangs ~15 s then returns nearest-neighbour | `optimizeTours` permission denied — check Google Cloud Console → APIs & Services → Credentials and make sure the API key's API restrictions include the Route Optimization API | Either widen the key's API restrictions or unset `EQUISMILE_LIVE_MAPS` to fall back to the simulator. |
| `429 Too Many Requests` from Google | Demo session burned through the day's free quota | Either bump the GCP billing tier or unset `EQUISMILE_LIVE_MAPS`. |

## 9. What stays simulated (and why)

Even with `EQUISMILE_LIVE_MAPS=true`, these four are still mocked:

| Integration | Reason |
|---|---|
| WhatsApp send | A demo accidentally hitting `Send WhatsApp confirmation` for a seeded customer would text a real Swiss number. The mock returns a fake `wamid.demo-...` instantly. |
| Email send | Same shape — the SMTP simulator returns a fake `Message-Id` without touching nodemailer. |
| Inbound WhatsApp webhook | n8n is not part of the demo loop; the seeded enquiries already represent "what would have arrived". |
| Inbound email webhook | Same as above. |

If a future demo needs live messaging, ship a separate
`EQUISMILE_LIVE_WHATSAPP` / `EQUISMILE_LIVE_EMAIL` override using
the same shape as `isLiveMapsForced()` / `setLiveMapsForced()` —
keep them per-integration so "live everything" is never a single
foot-gun env var.
