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

REM Verify postgres is responding
docker exec equismile-postgres pg_isready -U equismile >nul 2>&1
if errorlevel 1 (
    echo  Waiting a bit longer for database...
    timeout /t 10 /nobreak >nul
)
echo  Database is ready.

echo.
echo  [4/8] Installing dependencies...
echo  -------------------------------------------------------
call npm install --silent 2>nul
if errorlevel 1 (
    call npm install
)

echo.
echo  [5/8] Setting up database schema...
echo  -------------------------------------------------------
set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile
set DEMO_MODE=true
set NEXT_PUBLIC_APP_URL=http://localhost:3000
set NEXT_PUBLIC_DEFAULT_LOCALE=en
set HOME_BASE_LAT=46.4553
set HOME_BASE_LNG=6.8561
set HOME_BASE_ADDRESS=Blonay, Switzerland

call npx prisma generate
call npx prisma migrate deploy

echo.
echo  [6/8] Loading demo data...
echo  -------------------------------------------------------
call npx tsx prisma/seed-demo.ts 2>nul
if errorlevel 1 (
    echo  Demo data may already be loaded - continuing.
)

echo.
echo  [7/8] Starting EquiSmile app...
echo  -------------------------------------------------------

REM Create a temporary .env file for the dev server
(
    echo DEMO_MODE=true
    echo DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile
    echo NEXT_PUBLIC_APP_URL=http://localhost:3000
    echo NEXT_PUBLIC_DEFAULT_LOCALE=en
    echo HOME_BASE_LAT=46.4553
    echo HOME_BASE_LNG=6.8561
    echo HOME_BASE_ADDRESS=Blonay, Switzerland
) > .env

REM Start Next.js in a new minimized window
start "EquiSmile App Server" /min cmd /c "set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile && set DEMO_MODE=true && npm run dev"

echo  App server starting...
echo  Waiting for app to be ready...

REM Poll until the app responds
set /a attempts=0
:wait_loop
set /a attempts+=1
if !attempts! gtr 60 (
    echo  [WARNING] App is taking longer than expected to start.
    echo  Check the minimized window for errors.
    goto :start_tunnel
)
timeout /t 2 /nobreak >nul
curl -sf http://localhost:3000/api/health >nul 2>&1
if errorlevel 1 (
    powershell -command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
    if errorlevel 1 goto :wait_loop
)

echo  App is ready!

:start_tunnel
echo.
echo  [8/8] Starting Pinggy tunnel...
echo  -------------------------------------------------------
echo.
echo  ======================================================
echo.
echo       EquiSmile is READY for your demo!
echo.
echo       Local:  http://localhost:3000/en
echo       French: http://localhost:3000/fr
echo       Demo:   http://localhost:3000/en/demo
echo.
echo       The Pinggy tunnel URL will appear below.
echo       Use that URL on your iPhone.
echo.
echo       To stop: close this window and the minimized one
echo.
echo  ======================================================
echo.

ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R0:localhost:3000 hXtmxAH6vAP@pro.pinggy.io
