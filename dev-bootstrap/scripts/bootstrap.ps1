#!/usr/bin/env pwsh
#
# dev-bootstrap: bring up the full local dev stack and apply Prisma migrations
# in any sibling project that ships a prisma/schema.prisma.
#
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$ParentDir = (Resolve-Path (Join-Path $RootDir "..")).Path
$Me        = Split-Path -Leaf $RootDir

Set-Location $RootDir

function Write-Step($msg)  { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Info($msg)  { Write-Host "    $msg" }
function Write-Warn($msg)  { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Fail($msg)  { Write-Host "  x $msg" -ForegroundColor Red; exit 1 }

function Require-Cmd($cmd) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Fail "required command not found: $cmd"
    }
}

Require-Cmd docker
docker compose version | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Fail "docker compose v2 not available" }

# --- 1. Copy env files (never overwrite) -----------------------------------
function Copy-IfMissing($Src, $Dst) {
    if (Test-Path $Dst) {
        Write-Info "$(Split-Path $Dst -Leaf) already exists - skipping (won't overwrite)"
    } else {
        Copy-Item $Src $Dst
        Write-Info "created $(Split-Path $Dst -Leaf) from template"
    }
}

Write-Step "Preparing env files"
Copy-IfMissing "env-templates/.env.template" ".env"
Copy-IfMissing "env-templates/.env.n8n.template" ".env.n8n"

# --- 2. Bring up core services ---------------------------------------------
Write-Step "Starting core services (Postgres, Redis, Mailpit, pgAdmin)"
docker compose --env-file .env -f docker/docker-compose.core.yml up -d
if ($LASTEXITCODE -ne 0) { Write-Fail "core compose up failed" }

# --- 3. Wait for Postgres healthcheck --------------------------------------
Write-Step "Waiting for Postgres to become healthy"
$maxAttempts = 60
$status = ""
for ($i = 0; $i -lt $maxAttempts; $i++) {
    $status = (docker inspect -f '{{.State.Health.Status}}' dev-postgres 2>$null)
    if ($status -eq "healthy") {
        Write-Info "Postgres is healthy"
        break
    }
    Start-Sleep -Seconds 2
}
if ($status -ne "healthy") {
    Write-Fail "Postgres did not become healthy in time"
}

# --- 4. Run Prisma migrations in sibling projects --------------------------
Write-Step "Scanning sibling directories for Prisma projects"
$foundAny = $false
Get-ChildItem -Path $ParentDir -Directory | ForEach-Object {
    if ($_.Name -eq $Me) { return }
    $schema = Join-Path $_.FullName "prisma/schema.prisma"
    if (-not (Test-Path $schema)) { return }

    $foundAny = $true
    Write-Info "found Prisma project: $($_.Name)"
    Push-Location $_.FullName
    try {
        if (-not (Test-Path "package.json")) {
            Write-Warn "$($_.Name) has no package.json - skipping"
            return
        }
        if (-not (Test-Path "node_modules")) {
            Write-Warn "$($_.Name) has no node_modules - run 'npm install' there first; skipping"
            return
        }
        Write-Info "running 'npx prisma migrate deploy' in $($_.Name)"
        npx prisma migrate deploy
        if ($LASTEXITCODE -ne 0) { Write-Warn "migrate deploy failed in $($_.Name)" }
    } finally {
        Pop-Location
    }
}
if (-not $foundAny) {
    Write-Info "no sibling Prisma projects found - skipping migrations"
}

# --- 5. Start n8n ----------------------------------------------------------
Write-Step "Starting n8n"
docker compose --env-file .env.n8n -f docker/docker-compose.n8n.yml up -d
if ($LASTEXITCODE -ne 0) { Write-Fail "n8n compose up failed" }

# --- Done ------------------------------------------------------------------
# Read .env so the summary reflects whatever the user configured.
function Get-EnvValue($Key, $Default) {
    if (-not (Test-Path ".env")) { return $Default }
    foreach ($line in Get-Content ".env") {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=\s*(.*?)\s*$") {
            $val = $Matches[1] -replace '^"|"$', '' -replace "^'|'$", ""
            if ($val) { return $val }
        }
    }
    return $Default
}

$pgPort      = Get-EnvValue "POSTGRES_PORT"   "5432"
$pgUser      = Get-EnvValue "POSTGRES_USER"   "devuser"
$pgDb        = Get-EnvValue "POSTGRES_DB"     "devdb"
$redisPort   = Get-EnvValue "REDIS_PORT"      "6379"
$mailpitPort = Get-EnvValue "MAILPIT_UI_PORT" "8025"
$pgadminPort = Get-EnvValue "PGADMIN_PORT"    "5050"

Write-Host ""
Write-Host "==> dev-bootstrap done" -ForegroundColor Green
Write-Host "    Postgres   : localhost:$pgPort  (user=$pgUser db=$pgDb)"
Write-Host "    Redis      : localhost:$redisPort"
Write-Host "    Mailpit UI : http://localhost:$mailpitPort"
Write-Host "    pgAdmin    : http://localhost:$pgadminPort"
Write-Host "    n8n        : http://localhost:5678"
