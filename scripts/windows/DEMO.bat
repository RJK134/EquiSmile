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
