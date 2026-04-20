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
echo  [1/7] Pulling latest code...
echo  -------------------------------------------------------
git pull
if errorlevel 1 (
    echo  [WARNING] Git pull failed - continuing with current code
)

echo.
echo  [2/7] Checking Docker...
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
echo  [3/7] Starting PostgreSQL database...
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
echo  [4/7] Loading environment from .env...
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
echo  [5/7] Setting up database schema + demo data...
echo  -------------------------------------------------------
call npx prisma generate
call npx prisma migrate deploy
call npx tsx prisma/seed-demo.ts 2>nul
if errorlevel 1 (
    echo  Demo data may already be loaded - continuing.
)

echo.
echo  [6/7] Building production app (required for mobile)...
echo  -------------------------------------------------------
call npm run build
if errorlevel 1 (
    echo.
    echo  [ERROR] Build failed! Check errors above.
    pause
    exit /b 1
)

echo.
echo  [7/7] Starting EquiSmile...
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
echo       To stop: press Ctrl+C
echo.
echo  ======================================================
echo.

npm run start
