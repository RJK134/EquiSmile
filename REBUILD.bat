@echo off
echo.
echo  Rebuilding EquiSmile with latest changes...
echo.
cd /d D:\Projects\Equismile\EquiSmile
git pull
set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile
set DEMO_MODE=true
echo  Building...
call npm run build
echo.
echo  Starting app... Wait for "Ready" then refresh your phone.
echo.
npm run start
