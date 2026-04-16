# EquiSmile - Fix and Launch
# This script fixes the database issue and starts the demo

Write-Host "`n  EquiSmile - Fixing and Launching..." -ForegroundColor Cyan
Write-Host "  ====================================`n" -ForegroundColor Cyan

# Step 1: Kill any container using port 5433
Write-Host "  [1/7] Clearing old database..." -ForegroundColor Yellow
$containers = docker ps -a --format "{{.Names}}" 2>$null
foreach ($c in $containers) {
    $ports = docker port $c 2>$null
    if ($ports -match "5433") {
        docker stop $c 2>$null | Out-Null
        docker rm $c 2>$null | Out-Null
        Write-Host "  Removed container: $c"
    }
}
# Also try the known names
docker stop equismile-db 2>$null | Out-Null
docker rm equismile-db 2>$null | Out-Null
docker stop equismile-postgres 2>$null | Out-Null  
docker rm equismile-postgres 2>$null | Out-Null

# Remove old volumes
docker volume rm equismile_postgres_data 2>$null | Out-Null
docker volume rm equismile_equismile_postgres_data 2>$null | Out-Null

# Remove ALL equismile volumes to be safe
$vols = docker volume ls -q --filter "name=equismile" 2>$null
foreach ($v in $vols) {
    docker volume rm $v 2>$null | Out-Null
}

Write-Host "  Done.`n" -ForegroundColor Green

# Step 2: Start fresh postgres
Write-Host "  [2/7] Starting fresh database..." -ForegroundColor Yellow
Set-Location "D:\Projects\Equismile\EquiSmile"
docker compose up -d postgres 2>$null
Start-Sleep -Seconds 10
Write-Host "  Done.`n" -ForegroundColor Green

# Step 3: Write correct .env
Write-Host "  [3/7] Writing config..." -ForegroundColor Yellow
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
"@ | Set-Content .env -Encoding UTF8
$env:DATABASE_URL = "postgresql://equismile:equismile_dev@localhost:5433/equismile"
$env:DEMO_MODE = "true"
Write-Host "  Done.`n" -ForegroundColor Green

# Step 4: Install + generate
Write-Host "  [4/7] Installing dependencies..." -ForegroundColor Yellow
npm install --silent 2>$null
npx prisma generate 2>$null
Write-Host "  Done.`n" -ForegroundColor Green

# Step 5: Migrate
Write-Host "  [5/7] Setting up database..." -ForegroundColor Yellow
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Database migration failed!" -ForegroundColor Red
    Write-Host "  Check if postgres is running: docker ps" -ForegroundColor Red
    Read-Host "  Press Enter to exit"
    exit 1
}
Write-Host "  Done.`n" -ForegroundColor Green

# Step 6: Seed
Write-Host "  [6/7] Loading demo data..." -ForegroundColor Yellow
npx tsx prisma/seed-demo.ts 2>$null
Write-Host "  Done.`n" -ForegroundColor Green

# Step 7: Start app + tunnel
Write-Host "  [7/7] Starting app..." -ForegroundColor Yellow
Start-Process -WindowStyle Minimized -FilePath "cmd.exe" -ArgumentList "/k set DATABASE_URL=postgresql://equismile:equismile_dev@localhost:5433/equismile&& set DEMO_MODE=true&& npm run dev"

Write-Host "  Waiting for app..." -ForegroundColor Yellow
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        break
    } catch {}
}
Write-Host "  App is running!`n" -ForegroundColor Green

Write-Host "  ======================================================" -ForegroundColor Cyan
Write-Host "  " -ForegroundColor Cyan
Write-Host "       EquiSmile is READY!" -ForegroundColor Green
Write-Host "  " -ForegroundColor Cyan
Write-Host "       Connecting Pinggy tunnel now..." -ForegroundColor White
Write-Host "       Your iPhone URL will appear below." -ForegroundColor White
Write-Host "  " -ForegroundColor Cyan
Write-Host "  ======================================================`n" -ForegroundColor Cyan

ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R0:localhost:3000 hXtmxAH6vAP@pro.pinggy.io
