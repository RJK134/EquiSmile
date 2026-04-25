@echo off
echo.
echo  Rebuilding EquiSmile with latest changes...
echo.
cd /d D:\Projects\Equismile\EquiSmile
git pull
set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile
set DEMO_MODE=true

REM Self-healing dep install — same rationale as DEMO.bat / LAUNCH.bat.
echo  Reinstalling Node dependencies...
call npm ci --no-audit --no-fund
if errorlevel 1 (
    echo  [WARN] npm ci failed - falling back to npm install...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo  [ERROR] Could not install Node dependencies.
        pause
        exit /b 1
    )
)

echo  Building...
call npm run build
if errorlevel 1 (
    echo.
    echo  [ERROR] Build failed! Scroll up for the actual error.
    pause
    exit /b 1
)

echo.
echo  Starting app... Wait for "Ready" then refresh your phone.
echo.
REM `call` is REQUIRED — without it, control transfers permanently
REM to npm.cmd and the post-run pause below never executes.
call npm run start

echo.
echo  EquiSmile has stopped. Press any key to close this window.
pause >nul
