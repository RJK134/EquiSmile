#!/usr/bin/env bash
#
# EquiSmile — Postgres backup helper
#
# Produces a compressed pg_dump of the EquiSmile database into
# `$BACKUP_DIR` (default `./backups`), rotates files older than
# `$BACKUP_RETENTION_DAYS` (default 14), and emits a one-line success
# record to stdout that a cron wrapper can redirect to syslog / file.
#
# Usage:
#   scripts/backup-db.sh                         # defaults
#   BACKUP_DIR=/var/backups/equismile \
#   BACKUP_RETENTION_DAYS=30 \
#   scripts/backup-db.sh
#
# Cron example (daily at 02:30):
#   30 2 * * * /opt/equismile/scripts/backup-db.sh >> /var/log/equismile-backup.log 2>&1
#
# Docker-native variant (from the host):
#   docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > /backups/equismile-$(date -u +%F).sql.gz
#
# Restore procedure — see docs/BACKUP.md for the full runbook.

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

: "${BACKUP_DIR:=./backups}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_COMPOSE_SERVICE:=postgres}"
: "${POSTGRES_USER:=equismile}"
: "${POSTGRES_DB:=equismile}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/equismile-${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# ---------------------------------------------------------------------------
# Dump. Prefer the compose service if available; fall back to a host
# pg_dump against DATABASE_URL when the operator is running outside
# compose.
# ---------------------------------------------------------------------------

if command -v docker >/dev/null 2>&1 && docker compose ps "${BACKUP_COMPOSE_SERVICE}" >/dev/null 2>&1; then
  docker compose exec -T "${BACKUP_COMPOSE_SERVICE}" \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
    | gzip -9 > "${OUT_FILE}"
elif [ -n "${DATABASE_URL:-}" ]; then
  pg_dump "${DATABASE_URL}" | gzip -9 > "${OUT_FILE}"
else
  echo "error: neither docker compose nor DATABASE_URL available for pg_dump" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Rotate. Delete anything older than the retention window. Keep at
# least one backup even if every file is older than retention (rare,
# but guards against a misconfigured cron wiping all history).
# ---------------------------------------------------------------------------

find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'equismile-*.sql.gz' \
  -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete || true

# Safety net: never leave the directory empty.
if [ -z "$(ls -A "${BACKUP_DIR}" 2>/dev/null)" ]; then
  echo "warning: backup directory empty after rotation — refusing to continue" >&2
  exit 2
fi

SIZE_BYTES=$(stat -c%s "${OUT_FILE}" 2>/dev/null || wc -c < "${OUT_FILE}")

echo "ok backup=${OUT_FILE} size_bytes=${SIZE_BYTES} retention_days=${BACKUP_RETENTION_DAYS}"
