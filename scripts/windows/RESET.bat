@echo off
setlocal enabledelayedexpansion
title EquiSmile Reset
color 4F

echo.
echo  ======================================================
echo       EquiSmile - Hard Reset
echo  ======================================================
echo.
echo  This will:
echo    1. Stop the running stack
echo    2. DESTROY the local Postgres volume (all demo data)
echo       NB: only the Postgres volume is dropped. Uploaded
echo           attachments, n8n workflows, and Caddy certs are
echo           preserved.
echo    3. Pull the latest code
echo    4. Reinstall Node dependencies
echo    5. Recreate the database from scratch
echo    6. Re-seed the demo data
echo    7. Rebuild and restart the app
echo.
echo  Use this when the app shows "Internal Server Error" after a
echo  big update, or when migrations have drifted. Demo data is
echo  recreated each time, so nothing real is lost.
echo.
echo  Press any key to continue, or close the window to abort...
pause >nul

cd /d D:\Projects\Equismile\EquiSmile

echo.
echo  [1/7] Stopping running stack (containers only - volumes preserved)...
echo  -------------------------------------------------------
REM Plain `down` stops + removes containers and the default network.
REM We deliberately do NOT use `down -v` here: that wipes ALL named
REM volumes (n8n_data, attachments_data, caddy_data/config,
REM backups_data) which the operator does not expect to lose. We
REM target only postgres_data in step 2.
docker compose down
if errorlevel 1 (
    echo.
    echo  [ERROR] Could not stop the stack. Is Docker Desktop running?
    pause
    exit /b 1
)
echo  Stack stopped.

echo.
echo  [2/7] Destroying ONLY the Postgres data volume...
echo  -------------------------------------------------------
REM Compose project name is derived from the directory ("EquiSmile"
REM lowercased by Docker), so the qualified volume name is
REM "equismile_postgres_data". If the operator overrode
REM COMPOSE_PROJECT_NAME this script falls back to a label-scoped
REM lookup. We must NOT silently swallow failure here — a corrupt
REM DB that the script can't drop is the exact scenario this
REM launcher exists to fix.
docker volume rm equismile_postgres_data
if errorlevel 1 (
    echo.
    echo  [WARN] Direct volume removal failed - trying label lookup...
    for /f "usebackq tokens=*" %%v in (`docker volume ls --filter "label=com.docker.compose.volume=postgres_data" --format "{{.Name}}"`) do (
        echo  Found postgres volume: %%v
        docker volume rm %%v
        if errorlevel 1 (
            echo.
            echo  [ERROR] Could not remove %%v. The volume may be in use.
            echo  Stop any container that mounts it, then re-run RESET.bat.
            pause
            exit /b 1
        )
    )
)
echo  Postgres volume destroyed.

echo.
echo  [3/7] Pulling latest code...
echo  -------------------------------------------------------
git pull
if errorlevel 1 (
    echo  [WARNING] Git pull failed - continuing with current code
)

echo.
echo  [4/7] Reinstalling Node dependencies...
echo  -------------------------------------------------------
call npm ci --no-audit --no-fund
if errorlevel 1 (
    echo  [WARN] npm ci failed - falling back to npm install...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo  [ERROR] Could not install Node dependencies.
        pause
        exit /b 1
    )
)

echo.
echo  [5/7] Starting Postgres + applying migrations...
echo  -------------------------------------------------------
docker compose up -d postgres
echo  Waiting for database to be ready...
timeout /t 8 /nobreak >nul
docker exec equismile-postgres pg_isready -U equismile >nul 2>&1
if errorlevel 1 (
    echo  Waiting a bit longer...
    timeout /t 10 /nobreak >nul
)

set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile
set DEMO_MODE=true
set NEXT_PUBLIC_APP_URL=http://localhost:3000
set NEXT_PUBLIC_DEFAULT_LOCALE=en
set HOME_BASE_LAT=46.4553
set HOME_BASE_LNG=6.8561
set HOME_BASE_ADDRESS=Blonay, Switzerland

call npx prisma generate
call npx prisma migrate deploy
if errorlevel 1 (
    echo.
    echo  [ERROR] Migration failed. Scroll up to see the database error.
    pause
    exit /b 1
)
echo  Database is ready.

echo.
echo  [6/7] Re-seeding demo data...
echo  -------------------------------------------------------
call npx tsx prisma/seed-demo.ts
if errorlevel 1 (
    echo.
    echo  [ERROR] Demo seed failed. Scroll up to see the error.
    pause
    exit /b 1
)
echo  Demo data loaded.

echo.
echo  [7/7] Building and starting app...
echo  -------------------------------------------------------
call npm run build
if errorlevel 1 (
    echo.
    echo  [ERROR] Build failed! Scroll up for the actual error.
    pause
    exit /b 1
)

echo.
echo  ======================================================
echo.
echo       EquiSmile is starting after a clean reset...
echo.
echo       Local:   http://localhost:3000/en
echo       French:  http://localhost:3000/fr
echo       Demo:    http://localhost:3000/en/demo
echo.
echo       To stop: press Ctrl+C, or double-click STOP.bat
echo.
echo  ======================================================
echo.

call npm run start

echo.
echo  EquiSmile has stopped. Press any key to close this window.
pause >nul
