@echo off
setlocal enabledelayedexpansion
title EquiSmile Production Launcher
color 2F

echo.
echo  ======================================================
echo       EquiSmile - Production Launcher
echo  ======================================================
echo.
echo  This starts EquiSmile using your .env credentials.
echo  Integrations run LIVE when credentials are configured.
echo.
echo  For demo mode (no real APIs), use DEMO.bat instead.
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

REM Set required defaults (only used if .env is missing)
set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile
set NEXT_PUBLIC_APP_URL=http://localhost:3000
set NEXT_PUBLIC_DEFAULT_LOCALE=en
set HOME_BASE_LAT=46.4553
set HOME_BASE_LNG=6.8561
set HOME_BASE_ADDRESS=Blonay, Switzerland

REM DO NOT set DEMO_MODE here — let .env control it.
REM If .env is missing or doesn't set DEMO_MODE, it defaults to 'false' in lib/env.ts.

if exist .env (
    echo  Loading .env file...
    for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
        if not "%%a"=="" if not "%%b"=="" (
            REM Strip trailing whitespace and inline comments from value
            set "val=%%b"
            for /f "tokens=1" %%v in ("%%b") do set "val=%%v"
            set "%%a=!val!"
        )
    )
    echo  Credentials loaded from .env file.
) else (
    echo  [WARNING] No .env file found!
    echo  Create a .env file from .env.example with your API keys.
    echo  Without credentials, integrations will run in demo mode.
)

REM Report detected modes
echo.
echo  Integration status:
if defined DEMO_MODE (
    echo    DEMO_MODE        = !DEMO_MODE!
) else (
    echo    DEMO_MODE        = false (default)
)
if defined GOOGLE_MAPS_API_KEY (
    echo    Google Maps      = configured
) else (
    echo    Google Maps      = not configured (will use demo)
)
if defined WHATSAPP_ACCESS_TOKEN (
    echo    WhatsApp         = configured
) else if defined WHATSAPP_API_TOKEN (
    echo    WhatsApp         = configured
) else (
    echo    WhatsApp         = not configured (will use demo)
)
if defined SMTP_PASSWORD (
    echo    Email/SMTP       = configured
) else (
    echo    Email/SMTP       = not configured (will use demo)
)

echo.
echo  [5/8] Installing / updating Node dependencies...
echo  -------------------------------------------------------
REM Self-healing: re-sync node_modules to whatever main expects.
REM Prevents "module not found" / Prisma client mismatch after a
REM `git pull` that touched package.json or package-lock.json.
call npm ci --no-audit --no-fund
if errorlevel 1 (
    echo.
    echo  [WARN] npm ci failed - falling back to npm install...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo  [ERROR] Could not install Node dependencies.
        echo  Check your network connection, then re-run LAUNCH.bat.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo  [6/8] Setting up database schema...
echo  -------------------------------------------------------
call npx prisma generate
call npx prisma migrate deploy

echo.
echo  [7/8] Building production app (required for mobile)...
echo  -------------------------------------------------------
call npm run build
if errorlevel 1 (
    echo.
    echo  [ERROR] Build failed! Scroll up to see the actual error.
    echo  Most common cause: dependency mismatch after `git pull`.
    echo  Try re-running LAUNCH.bat - step 5 will reinstall.
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
echo       Health:  http://localhost:3000/api/health
echo.
echo       For mobile access, open another terminal and run:
echo       ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R0:localhost:3000 hXtmxAH6vAP@pro.pinggy.io
echo.
echo       To stop: press Ctrl+C, or double-click STOP.bat
echo.
echo  ======================================================
echo.

npm run start

REM Always pause if `npm run start` exits — keeps the window open
REM so you can see why instead of it vanishing on error.
echo.
echo  EquiSmile has stopped. Press any key to close this window.
pause >nul
