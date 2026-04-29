#!/usr/bin/env bash
#
# reset-db: drop + recreate the dev database and re-run Prisma migrations.
# Requires confirmation. Affects only the app's dev DB, not n8n's DB.
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

# Load env if present
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DB_USER="${POSTGRES_USER:-devuser}"
DB_NAME="${POSTGRES_DB:-devdb}"
CONTAINER="dev-postgres"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  fail "container '$CONTAINER' is not running. Run scripts/bootstrap.sh first."
fi

cat <<EOF
About to DROP and RECREATE database '$DB_NAME' on container '$CONTAINER'.
Every row in that database will be destroyed. This is irreversible.
EOF
read -r -p "Type 'yes' to continue: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

log "Terminating existing connections to $DB_NAME"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
  >/dev/null

log "Dropping database $DB_NAME"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d postgres -c \
  "DROP DATABASE IF EXISTS \"$DB_NAME\";"

log "Creating database $DB_NAME"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d postgres -c \
  "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"

log "Re-running Prisma migrations in sibling projects"
shopt -s nullglob
found_any=0
for dir in "$PARENT_DIR"/*/; do
  project="$(basename "$dir")"
  [[ "$project" == "$ME" ]] && continue
  [[ -f "$dir/prisma/schema.prisma" ]] || continue

  found_any=1
  info "$project"
  (
    cd "$dir"
    if [[ ! -d node_modules ]]; then
      warn "$project has no node_modules — skipping"
      exit 0
    fi
    npx --no-install prisma migrate deploy || npx prisma migrate deploy
  ) || warn "migrate deploy failed in $project — continuing"
done
if (( found_any == 0 )); then
  info "no sibling Prisma projects found — nothing to migrate"
fi

log "reset-db done"
