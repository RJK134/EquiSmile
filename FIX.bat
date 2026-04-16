@echo off
echo.
echo  Fixing EquiSmile...
echo.
cd /d D:\Projects\Equismile\EquiSmile
git pull
set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile
set DEMO_MODE=true
echo  Applying database fix...
call npx prisma generate 2>nul
call npx prisma migrate deploy
echo  Loading demo data (with triage tasks)...
call npx tsx prisma/seed-demo.ts 2>nul
echo.
echo  Building production app...
call npm run build
echo.
echo  Starting app... Wait for "Ready" then refresh your phone.
echo.
npm run start
