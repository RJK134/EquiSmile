#!/usr/bin/env bash
#
# dev-bootstrap: bring up the full local dev stack and apply Prisma migrations
# in any sibling project that ships a prisma/schema.prisma.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_DIR="$(cd "$ROOT_DIR/.." && pwd)"
ME="$(basename "$ROOT_DIR")"

cd "$ROOT_DIR"

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m  x %s\033[0m\n' "$*"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_cmd docker
docker compose version >/dev/null 2>&1 || fail "docker compose v2 not available"

# --- 1. Copy env files (never overwrite) ------------------------------------
copy_if_missing() {
  local src="$1" dst="$2"
  if [[ -f "$dst" ]]; then
    info "$(basename "$dst") already exists — skipping (won't overwrite)"
  else
    cp "$src" "$dst"
    info "created $(basename "$dst") from template"
  fi
}

log "Preparing env files"
copy_if_missing "env-templates/.env.template" ".env"
copy_if_missing "env-templates/.env.n8n.template" ".env.n8n"

# --- 2. Bring up core services ---------------------------------------------
log "Starting core services (Postgres, Redis, Mailpit, pgAdmin)"
docker compose --env-file .env -f docker/docker-compose.core.yml up -d

# --- 3. Wait for Postgres healthcheck --------------------------------------
log "Waiting for Postgres to become healthy"
attempt=0
max_attempts=60
while :; do
  status="$(docker inspect -f '{{.State.Health.Status}}' dev-postgres 2>/dev/null || echo "starting")"
  if [[ "$status" == "healthy" ]]; then
    info "Postgres is healthy"
    break
  fi
  attempt=$((attempt + 1))
  if (( attempt >= max_attempts )); then
    fail "Postgres did not become healthy after $max_attempts attempts"
  fi
  sleep 2
done

# --- 4. Run Prisma migrations in sibling projects --------------------------
log "Scanning sibling directories for Prisma projects"
shopt -s nullglob
found_any=0
for dir in "$PARENT_DIR"/*/; do
  project="$(basename "$dir")"
  [[ "$project" == "$ME" ]] && continue
  [[ -f "$dir/prisma/schema.prisma" ]] || continue

  found_any=1
  info "found Prisma project: $project"
  (
    cd "$dir"
    if [[ ! -f package.json ]]; then
      warn "$project has no package.json — skipping"
      exit 0
    fi
    if [[ ! -d node_modules ]]; then
      warn "$project has no node_modules — run 'npm install' there first; skipping"
      exit 0
    fi
    info "running 'npx prisma migrate deploy' in $project"
    npx --no-install prisma migrate deploy || npx prisma migrate deploy
  )
done
if (( found_any == 0 )); then
  info "no sibling Prisma projects found — skipping migrations"
fi

# --- 5. Start n8n ----------------------------------------------------------
log "Starting n8n"
docker compose --env-file .env.n8n -f docker/docker-compose.n8n.yml up -d

# --- Done ------------------------------------------------------------------
# shellcheck disable=SC1091
set -a; source .env; set +a

printf '\n\033[1;32m==> dev-bootstrap done\033[0m\n'
printf '    Postgres   : localhost:%s  (user=%s db=%s)\n' \
  "${POSTGRES_PORT:-5432}" "${POSTGRES_USER:-devuser}" "${POSTGRES_DB:-devdb}"
printf '    Redis      : localhost:%s\n' "${REDIS_PORT:-6379}"
printf '    Mailpit UI : http://localhost:%s\n' "${MAILPIT_UI_PORT:-8025}"
printf '    pgAdmin    : http://localhost:%s\n' "${PGADMIN_PORT:-5050}"
printf '    n8n        : http://localhost:5678\n'
