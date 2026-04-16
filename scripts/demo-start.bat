@echo off
setlocal enabledelayedexpansion

echo.
echo  EquiSmile - Demo Mode Startup (Docker)
echo  ========================================
echo.

REM Check Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)

REM Create .env if it doesn't exist
if not exist .env (
    echo  Creating .env with demo defaults...
    (
        echo DEMO_MODE=true
        echo POSTGRES_USER=equismile
        echo POSTGRES_PASSWORD=equismile_dev
        echo POSTGRES_DB=equismile
        echo DATABASE_URL=postgresql://equismile:equismile_dev@postgres:5432/equismile
        echo NEXT_PUBLIC_APP_URL=http://localhost
        echo NEXT_PUBLIC_DEFAULT_LOCALE=en
        echo HOME_BASE_LAT=46.4553
        echo HOME_BASE_LNG=6.8561
        echo HOME_BASE_ADDRESS=Blonay, Switzerland
    ) > .env
) else (
    echo  Using existing .env file
)

echo.
echo  Building and starting services...
echo  This may take 2-3 minutes on first run.
echo.

docker compose up --build -d

echo.
echo  Waiting for services to start...
timeout /t 30 /nobreak >nul

echo.
echo  EquiSmile should be ready!
echo.
echo    App:           http://localhost
echo    Demo Panel:    http://localhost/en/demo
echo    French:        http://localhost/fr
echo.
echo    To stop: docker compose down
echo    To reset: docker compose down -v ^& scripts\demo-start.bat
echo.
pause
