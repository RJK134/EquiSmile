Write-Host ""
Write-Host "  EquiSmile - Local Demo Mode" -ForegroundColor Cyan
Write-Host "  ============================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERROR] Node.js is required. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

if (-not (docker info 2>$null)) {
    Write-Host "  [ERROR] Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Create .env
if (-not (Test-Path .env)) {
    Write-Host "  Creating .env with demo defaults..."
    @"
DEMO_MODE=true
DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile
POSTGRES_USER=equismile
POSTGRES_PASSWORD=equismile_dev
POSTGRES_DB=equismile
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_LOCALE=en
HOME_BASE_LAT=46.4553
HOME_BASE_LNG=6.8561
HOME_BASE_ADDRESS=Blonay, Switzerland
"@ | Set-Content .env
}

Write-Host "  Starting PostgreSQL..." -ForegroundColor Yellow
docker compose up -d postgres
Start-Sleep -Seconds 8

Write-Host "  Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "  Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate

Write-Host "  Running migrations..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://equismile:equismile_dev@localhost:5433/equismile"
npx prisma migrate deploy

Write-Host "  Seeding demo data..." -ForegroundColor Yellow
npx tsx prisma/seed-demo.ts

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "   EquiSmile is starting!" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "    App:           http://localhost:3000" -ForegroundColor White
Write-Host "    Demo Panel:    http://localhost:3000/en/demo" -ForegroundColor White
Write-Host "    French:        http://localhost:3000/fr" -ForegroundColor White
Write-Host ""

$env:DEMO_MODE = "true"
npm run dev
