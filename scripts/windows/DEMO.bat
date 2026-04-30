@echo off
setlocal enabledelayedexpansion
title EquiSmile Demo Launcher
color 1F

echo.
echo  ======================================================
echo       EquiSmile - One-Click Demo Launcher
echo  ======================================================
echo.
echo  This will start the full demo environment.
echo  Keep this window open during your demo.
echo.
echo  Press any key to start...
pause >nul

cd /d D:\Projects\Equismile\EquiSmile

echo.
echo  [1/8] Pulling latest code...
echo  -------------------------------------------------------
git pull
if errorlevel 1 (
    echo  [WARNING] Git pull failed - continuing with current code
)

echo.
echo  [2/8] Checking Docker...
echo  -------------------------------------------------------
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Docker Desktop is not running!
    echo  Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)
echo  Docker is running.

echo.
echo  [3/8] Starting PostgreSQL database...
echo  -------------------------------------------------------
docker compose up -d postgres
echo  Waiting for database to be ready...
timeout /t 8 /nobreak >nul
docker exec equismile-postgres pg_isready -U equismile >nul 2>&1
if errorlevel 1 (
    echo  Waiting a bit longer for database...
    timeout /t 10 /nobreak >nul
)
echo  Database is ready.

echo.
echo  [4/8] Loading environment from .env...
echo  -------------------------------------------------------
REM Core settings (always set these)
set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile
REM DEMO.bat always forces demo mode. For live credentials, use LAUNCH.bat.
set DEMO_MODE=true
set NEXT_PUBLIC_APP_URL=http://localhost:3000
set NEXT_PUBLIC_DEFAULT_LOCALE=en
set HOME_BASE_LAT=46.4553
set HOME_BASE_LNG=6.8561
set HOME_BASE_ADDRESS=Blonay, Switzerland

REM Auth.js v5 refuses to serve /api/auth/* without AUTH_SECRET and the
REM dashboard then 500s on the session call. The .env block below
REM overrides this if present (so production-shape secrets still win),
REM but a fresh demo box without .env should not crash before sign-in.
REM This default is deliberately *not* secret — DEMO_MODE-only.
set AUTH_SECRET=demo-not-for-production-only-for-local-DEMO_MODE-walkthrough

REM Load additional vars from .env file if it exists
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        set "line=%%a"
        if not "!line:~0,1!"=="#" (
            if not "%%a"=="" set "%%a=%%b"
        )
    )
    echo  Loaded credentials from .env file.
) else (
    echo  [WARNING] No .env file found - API integrations will be limited.
    echo  Create a .env file with your API keys for full functionality.
)

REM Report active integration modes so the operator can see at a
REM glance whether the demo will use live Google + simulated
REM messaging (the safe shape for client demos) or all-simulated.
echo.
echo  Integration status:
echo    DEMO_MODE          = %DEMO_MODE%
if /i "%EQUISMILE_LIVE_MAPS%"=="true" (
    echo    Google Maps        = LIVE  ^(EQUISMILE_LIVE_MAPS=true^)
    if not defined GOOGLE_MAPS_API_KEY (
        echo      [WARNING] EQUISMILE_LIVE_MAPS=true but GOOGLE_MAPS_API_KEY is unset.
        echo      The client will silently fall back to the simulator.
    )
    if not defined GCP_PROJECT_ID (
        echo      [WARNING] EQUISMILE_LIVE_MAPS=true but GCP_PROJECT_ID is unset.
        echo      Route Optimization will fall back to the local algorithm.
    )
) else (
    echo    Google Maps        = simulated  ^(set EQUISMILE_LIVE_MAPS=true in .env for live^)
)
echo    WhatsApp           = simulated  ^(DEMO_MODE forces this^)
echo    Email/SMTP         = simulated  ^(DEMO_MODE forces this^)
if defined NEXT_PUBLIC_APP_URL echo    Public app URL     = %NEXT_PUBLIC_APP_URL%
if defined AUTH_URL echo    Auth.js callback   = %AUTH_URL%
if "%AUTH_SECRET:~0,5%"=="demo-" (
    echo    AUTH_SECRET        = demo fallback  ^(set AUTH_SECRET in .env to override^)
) else if defined AUTH_SECRET (
    echo    AUTH_SECRET        = from .env  ^(***redacted***^)
) else (
    echo    AUTH_SECRET        = [WARNING] not set - Auth.js will 500
)

echo.
echo  [5/8] Installing / updating Node dependencies...
echo  -------------------------------------------------------
REM Self-healing: re-sync node_modules to whatever main now expects.
REM Without this step, a `git pull` that touches package.json or
REM package-lock.json leaves the working tree in a broken state and
REM the build at step 7 fails with "module not found" or a Prisma
REM client mismatch. `npm ci` is strictly deterministic from the
REM lockfile and faster than `npm install` once the cache is warm.
call npm ci --no-audit --no-fund
if errorlevel 1 (
    echo.
    echo  [WARN] npm ci failed - falling back to npm install...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo  [ERROR] Could not install Node dependencies.
        echo  Check your network connection, then re-run DEMO.bat.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo  [6/8] Setting up database schema + demo data...
echo  -------------------------------------------------------
call npx prisma generate
call npx prisma migrate deploy
call npx tsx prisma/seed-demo.ts 2>nul
if errorlevel 1 (
    echo  Demo data may already be loaded - continuing.
)

echo.
echo  [7/8] Building production app (required for mobile)...
echo  -------------------------------------------------------
call npm run build
if errorlevel 1 (
    echo.
    echo  [ERROR] Build failed! Scroll up to see the actual error.
    echo  Most common cause: dependency mismatch after `git pull`.
    echo  Try re-running DEMO.bat - step 5 will reinstall.
    echo.
    pause
    exit /b 1
)

echo.
echo  [8/8] Starting EquiSmile...
echo  -------------------------------------------------------
echo.
echo  ======================================================
echo.
echo       EquiSmile is starting...
echo.
echo       Local:   http://localhost:3000/en
echo       French:  http://localhost:3000/fr
echo       Demo:    http://localhost:3000/en/demo
echo.
echo       For mobile / iPhone access via Pinggy tunnel, open
echo       another terminal and run:
echo       ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R0:localhost:3000 hXtmxAH6vAP@pro.pinggy.io
echo.
echo       Then put the printed https://*.pinggy.io URL into .env
echo       as NEXT_PUBLIC_APP_URL and AUTH_URL, and re-run this
echo       script. See docs\DEMO_RUNBOOK.md for the full client
echo       demo flow (live Google Maps + simulated messaging).
echo.
echo       Vet UAT testing? See docs\uat\UAT_VET_PERSONA.md
echo       (persona) and docs\uat\UAT_FEEDBACK_REPORT.md (form).
echo.
echo       To stop: press Ctrl+C, or double-click STOP.bat
echo.
echo  ======================================================
echo.

REM `next.config.ts` sets `output: 'standalone'` (for Docker), which
REM means `next start` refuses to serve the build with the message
REM:   "next start" does not work with "output: standalone"
REM Instead we run the standalone server entry point directly. Two
REM things need copying into .next/standalone first because the
REM standalone bundle deliberately omits static assets:
REM   - .next/static -> .next/standalone/.next/static
REM   - public       -> .next/standalone/public
echo  Copying static assets into the standalone bundle...
if not exist .next\standalone\.next mkdir .next\standalone\.next
xcopy .next\static .next\standalone\.next\static /E /I /Y /Q >nul
xcopy public .next\standalone\public /E /I /Y /Q >nul

set PORT=3000
set HOSTNAME=0.0.0.0
REM `call` is REQUIRED here — without it, control transfers
REM permanently to node.exe and the post-run pause below never
REM executes, so the window vanishes on Ctrl-C / crash anyway.
call node .next\standalone\server.js

REM Always pause if the server exits — keeps the window open
REM so you can see why instead of it vanishing on error.
echo.
echo  EquiSmile has stopped. Press any key to close this window.
pause >nul
