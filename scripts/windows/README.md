# Windows Launchers

One-click helpers for running EquiSmile on a Windows workstation. These were previously at the repo root; moved here to keep the project root clean.

| File | What it does |
|---|---|
| `DEMO.bat` | Starts the full demo stack (Docker + app + Pinggy tunnel) in demo mode. Safe to share externally; all integrations return mock responses. |
| `DEMO-STOP.bat` | Stops the demo stack started by `DEMO.bat`. |
| `LAUNCH.bat` | Starts the app with **live** credentials from `.env` (WhatsApp, Google Maps, SMTP). Use for real operational work. |
| `REBUILD.bat` | Rebuilds the Next.js production bundle (with the Google Maps browser key baked in) before relaunching. |
| `FIX.bat` | One-click "nuke and start fresh" — rebuilds the database and restarts. Use if migrations drift. |
| `FIX-AND-LAUNCH.ps1` | PowerShell variant of `FIX.bat` with explicit error handling. |

## Usage

From a Windows Command Prompt or PowerShell in the repo root:

```cmd
scripts\windows\DEMO.bat
```

The scripts `cd` to the client's hardcoded install path (`D:\Projects\Equismile\EquiSmile`). If you install elsewhere, edit the `cd /d` line at the top of each file.

## Non-Windows users

Use `npm run dev` or `docker compose up -d` from the repo root — these `.bat` files are for the vet's Windows workstation only.
