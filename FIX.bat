@echo off
echo.
echo  Fixing EquiSmile...
echo.
cd /d D:\Projects\Equismile\EquiSmile
git pull
set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile
set DEMO_MODE=true
echo  Applying database fix...
call npx prisma migrate deploy
echo  Loading demo data...
call npx tsx prisma/seed-demo.ts 2>nul
echo.
echo  Building production app...
call npm run build
echo.
echo  Starting app...
echo  Wait for "Ready" then check your phone.
echo.
npm run start
