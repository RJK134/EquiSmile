# Windows Launchers

One-click helpers for running EquiSmile on the vet's Windows workstation.

## Two-tier layout (what to double-click)

To run the app, **double-click the launcher at the repo root**. Those root-level files are 1-line shims that call the canonical launcher in this folder.

| Repo root (use these) | Forwards to | What it does |
|---|---|---|
| `DEMO.bat` | `scripts\windows\DEMO.bat` | Starts the full demo stack with simulated WhatsApp / email / Google integrations. Safe to share. |
| `LAUNCH.bat` | `scripts\windows\LAUNCH.bat` | Starts with **live** `.env` credentials. Real Meta / Google / SMTP traffic. |
| `STOP.bat` | `scripts\windows\DEMO-STOP.bat` | Stops the running demo stack. |
| `RESET.bat` | `scripts\windows\RESET.bat` | **Hard reset.** Drops the Postgres volume, pulls latest code, reinstalls deps, recreates the DB, reseeds, rebuilds, restarts. Use when the app shows "Internal Server Error" after a big update — demo data is recreated each time so nothing real is lost. |

The shims exist so a fresh clone Just Works on double-click without having to navigate three folders deep in File Explorer. Behaviour lives in the canonical files in this folder; the shims are intentionally one-liners — edit the canonical file, never the shim.

## All canonical launchers

| File | Purpose |
|---|---|
| `DEMO.bat` | Forces `DEMO_MODE=true`, mock integrations, demo seed data. The default for testing. |
| `DEMO-STOP.bat` | Stops the demo stack. |
| `LAUNCH.bat` | Live credentials from `.env`. For production-on-laptop work. |
| `REBUILD.bat` | Pull, reinstall deps, rebuild Next.js bundle, relaunch. Use after a `package.json` change. |
| `RESET.bat` | **The real "nuke and start fresh."** Drops the Postgres volume, recreates the DB from migrations, reseeds, rebuilds, restarts. The recovery path when "Internal Server Error" appears after a big update. |
| `FIX.bat` | Lightweight migrate + reseed (does NOT drop the volume). Kept for backwards compatibility — prefer `RESET.bat` for true recovery. |
| `FIX-AND-LAUNCH.ps1` | PowerShell variant of `FIX.bat` with explicit error handling. |

## Self-healing on `git pull`

`DEMO.bat`, `LAUNCH.bat`, and `REBUILD.bat` all run `npm ci` before the build. This means a `git pull` that touches `package.json` or `package-lock.json` no longer breaks the next launch — dependencies are re-synced automatically. If `npm ci` fails (e.g. lockfile drift from a manual `npm install`), the script falls back to `npm install`. If both fail, you see a clear error and the window stays open instead of vanishing.

The build step also pauses on failure with a hint about re-running, and the post-`npm run start` line pauses unconditionally so the window never just disappears mid-error.

## Install path

The canonical scripts `cd /d D:\Projects\Equismile\EquiSmile`. If you install elsewhere, edit that line at the top of each canonical file (the root shims pick the location up automatically via `%~dp0`).

## Client-demo flow (live Google Maps + simulated messaging)

For an iPhone-via-Pinggy client demo, use `DEMO.bat` with these
extra entries in your `.env` *before* launching:

```
EQUISMILE_LIVE_MAPS=true
GOOGLE_MAPS_API_KEY=AIza...
GCP_PROJECT_ID=your-project-id
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=AIza...
NEXT_PUBLIC_APP_URL=https://<your-tunnel>.pinggy.io
AUTH_URL=https://<your-tunnel>.pinggy.io
```

`DEMO.bat` will print an "Integration status" block at startup so
you can confirm Google is going live and WhatsApp/email are still
simulated before you hand the iPhone to the client. Full step-by-step
in [`../../docs/DEMO_RUNBOOK.md`](../../docs/DEMO_RUNBOOK.md).

For the vet UAT session that follows the demo, see
[`../../docs/uat/UAT_VET_PERSONA.md`](../../docs/uat/UAT_VET_PERSONA.md)
(persona) and
[`../../docs/uat/UAT_FEEDBACK_REPORT.md`](../../docs/uat/UAT_FEEDBACK_REPORT.md)
(form). Both are markdown — open in any browser via the GitHub
render or a local markdown preview extension.

## Non-Windows users

Use `./scripts/demo-start.sh` (or `docker compose up -d` for the bare stack). These `.bat` files are for the vet's Windows workstation only.
