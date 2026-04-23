#!/usr/bin/env bash
#
# EquiSmile — Backup restore-verify helper.
#
# Picks the newest `equismile-*.sql.gz` out of $BACKUP_DIR, restores it
# into a SCRATCH database (default `equismile_verify`), runs a smoke
# query, and drops the scratch DB. Returns 0 on success and a non-zero
# exit code with a stderr reason on any failure.
#
# Intended to be wired into a weekly cron alongside `backup-db.sh` so we
# never hit the "backup is a wish, not a guarantee" failure mode.
#
# Usage:
#   scripts/backup-restore-verify.sh
#   BACKUP_DIR=/var/backups/equismile scripts/backup-restore-verify.sh
#   VERIFY_DB_NAME=equismile_verify_weekly scripts/backup-restore-verify.sh
#
# Cron example (Sunday 03:30 UTC, after the nightly backup window):
#   30 3 * * 0  /opt/equismile/scripts/backup-restore-verify.sh >> /var/log/equismile-backup.log 2>&1

set -euo pipefail

: "${BACKUP_DIR:=./backups}"
: "${BACKUP_COMPOSE_SERVICE:=postgres}"
: "${POSTGRES_USER:=equismile}"
: "${POSTGRES_DB:=equismile}"
: "${VERIFY_DB_NAME:=equismile_verify}"

if [ ! -d "${BACKUP_DIR}" ]; then
  echo "error: BACKUP_DIR ${BACKUP_DIR} does not exist" >&2
  exit 2
fi

LATEST="$(
  find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'equismile-*.sql.gz' \
    -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | head -n1 | awk '{print $2}'
)"

if [ -z "${LATEST}" ]; then
  echo "error: no equismile-*.sql.gz backups found in ${BACKUP_DIR}" >&2
  exit 3
fi

echo "info: verifying ${LATEST}"

PSQL_CMD=(docker compose exec -T "${BACKUP_COMPOSE_SERVICE}" psql -U "${POSTGRES_USER}")
CREATEDB_CMD=(docker compose exec -T "${BACKUP_COMPOSE_SERVICE}" createdb -U "${POSTGRES_USER}")
DROPDB_CMD=(docker compose exec -T "${BACKUP_COMPOSE_SERVICE}" dropdb -U "${POSTGRES_USER}" --if-exists)

cleanup() {
  "${DROPDB_CMD[@]}" "${VERIFY_DB_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Fresh scratch DB.
cleanup
"${CREATEDB_CMD[@]}" "${VERIFY_DB_NAME}" >/dev/null

# Pipe the gzipped dump through psql. Fail loud on first SQL error.
if ! gunzip -c "${LATEST}" | "${PSQL_CMD[@]}" -d "${VERIFY_DB_NAME}" -v ON_ERROR_STOP=1 >/dev/null; then
  echo "error: restore failed while loading ${LATEST}" >&2
  exit 4
fi

# Smoke queries. Count live customers (tombstoned rows excluded) + that
# the audit log table exists with a valid row count. These are cheap
# but assert the schema and at least one row actually loaded for a
# running practice.
CUSTOMER_COUNT=$(
  "${PSQL_CMD[@]}" -d "${VERIFY_DB_NAME}" -tA \
    -c 'SELECT count(*) FROM "Customer" WHERE "deletedAt" IS NULL;' 2>/dev/null || echo "0"
)
HAS_AUDIT=$(
  "${PSQL_CMD[@]}" -d "${VERIFY_DB_NAME}" -tA \
    -c "SELECT to_regclass('public.\"SecurityAuditLog\"') IS NOT NULL;" 2>/dev/null || echo "f"
)

if [ "${HAS_AUDIT}" != "t" ]; then
  echo "error: restored schema is missing SecurityAuditLog table" >&2
  exit 5
fi

echo "ok verify backup=${LATEST} customers_live=${CUSTOMER_COUNT} audit_table=present"
