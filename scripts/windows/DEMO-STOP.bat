@echo off
echo.
echo  Stopping EquiSmile Demo...
echo  -------------------------------------------------------
echo.

cd /d D:\Projects\Equismile\EquiSmile

REM Kill Node.js processes for the dev server
taskkill /f /im node.exe 2>nul
echo  App server stopped.

REM Optionally stop postgres
echo.
set /p stopdb="Stop the database too? (y/n): "
if /i "%stopdb%"=="y" (
    docker compose down
    echo  Database stopped.
)

echo.
echo  Demo environment shut down.
echo.
pause
