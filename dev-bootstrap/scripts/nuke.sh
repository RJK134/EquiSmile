#!/usr/bin/env bash
#
# nuke: stop ALL dev-bootstrap containers and DELETE ALL volumes.
# This is irreversible. Requires typing 'nuke' to confirm.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

cat <<'EOF'
==============================================================
WARNING: this will stop ALL dev-bootstrap containers and
DELETE ALL VOLUMES (Postgres data, n8n data, Mailpit, pgAdmin).
This is irreversible.
==============================================================
EOF

read -r -p "Type 'nuke' to confirm: " confirm
if [[ "$confirm" != "nuke" ]]; then
  echo "Aborted."
  exit 1
fi

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }

log "Stopping n8n stack and removing its volumes"
if [[ -f .env.n8n ]]; then
  docker compose --env-file .env.n8n -f docker/docker-compose.n8n.yml down -v --remove-orphans || true
else
  docker compose -f docker/docker-compose.n8n.yml down -v --remove-orphans || true
fi

log "Stopping core stack and removing its volumes"
if [[ -f .env ]]; then
  docker compose --env-file .env -f docker/docker-compose.core.yml down -v --remove-orphans || true
else
  docker compose -f docker/docker-compose.core.yml down -v --remove-orphans || true
fi

log "nuke complete — all dev-bootstrap containers stopped and volumes removed"
