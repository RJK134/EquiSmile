@echo off
setlocal enabledelayedexpansion

echo.
echo  EquiSmile - Local Demo Mode
echo  ============================
echo.

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js is required. Install from https://nodejs.org
    exit /b 1
)

REM Check Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Docker is not running. Please start Docker Desktop.
    exit /b 1
)

REM Create .env if it doesn't exist
if not exist .env (
    echo  Creating .env with demo defaults...
    (
        echo DEMO_MODE=true
        echo DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5432/equismile
        echo POSTGRES_USER=equismile
        echo POSTGRES_PASSWORD=equismile_dev
        echo POSTGRES_DB=equismile
        echo NEXT_PUBLIC_APP_URL=http://localhost:3000
        echo NEXT_PUBLIC_DEFAULT_LOCALE=en
        echo HOME_BASE_LAT=46.4553
        echo HOME_BASE_LNG=6.8561
        echo HOME_BASE_ADDRESS=Blonay, Switzerland
    ) > .env
)

echo.
echo  Starting PostgreSQL...
docker compose up -d postgres
echo  Waiting for database to be ready...
timeout /t 8 /nobreak >nul

echo.
echo  Installing dependencies...
call npm install

echo.
echo  Generating Prisma client...
call npx prisma generate

echo.
echo  Running database migrations...
set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5432/equismile
call npx prisma migrate deploy

echo.
echo  Seeding demo data (8 Swiss customers, 20 horses, 12 enquiries)...
call npx tsx prisma/seed-demo.ts

echo.
echo  ============================================
echo   EquiSmile is starting in demo mode!
echo  ============================================
echo.
echo    App:           http://localhost:3000
echo    Demo Panel:    http://localhost:3000/en/demo
echo    French:        http://localhost:3000/fr
echo.
echo    Press Ctrl+C to stop the server
echo.

set DEMO_MODE=true
call npm run dev
