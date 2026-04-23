#!/bin/sh
#
# Entrypoint for the `backup` compose service.
#
# Runs pg_dump against the compose postgres service on `$BACKUP_CRON`
# (default: daily at 02:30 UTC) and leaves the gzipped dumps in the
# mounted `/backups` volume. Retention is managed by the script itself
# (`BACKUP_RETENTION_DAYS`).
#
# The service image is `postgres:16-alpine` so `pg_dump` matches the
# server version exactly — keeps the operator out of pg_dump-vs-server
# version-mismatch territory.

set -eu

: "${BACKUP_DIR:=/backups}"
: "${BACKUP_CRON:=30 2 * * *}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=equismile}"
: "${POSTGRES_DB:=equismile}"

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "error: POSTGRES_PASSWORD is not set" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
export PGPASSWORD="${POSTGRES_PASSWORD}"

# The self-contained backup one-liner we register with crond. Using
# printf so the env vars are expanded into the cron line exactly once
# (crond does not expand env vars at runtime).
CMD=$(printf '%s\n' \
  'set -eu' \
  'TS=$(date -u +%Y%m%dT%H%M%SZ)' \
  "OUT=${BACKUP_DIR}/equismile-\${TS}.sql.gz" \
  "pg_dump -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} | gzip -9 > \"\$OUT\"" \
  "find ${BACKUP_DIR} -maxdepth 1 -type f -name 'equismile-*.sql.gz' -mtime +${BACKUP_RETENTION_DAYS} -delete" \
  "echo \"ok backup=\$OUT size_bytes=\$(stat -c%s \"\$OUT\" 2>/dev/null || wc -c < \"\$OUT\") retention_days=${BACKUP_RETENTION_DAYS}\""
)

# Write crontab and launch crond in foreground.
CRONTAB_FILE=/etc/crontabs/root
echo "PGPASSWORD=${POSTGRES_PASSWORD}" > "${CRONTAB_FILE}"
echo "${BACKUP_CRON} PGPASSWORD='${POSTGRES_PASSWORD}' /bin/sh -c \"${CMD}\" >> /var/log/backup.log 2>&1" >> "${CRONTAB_FILE}"

# Always log startup line so operators can `docker compose logs backup`
# and see the service is alive and the schedule is correct.
echo "[backup] scheduler online cron='${BACKUP_CRON}' retention=${BACKUP_RETENTION_DAYS}d dir=${BACKUP_DIR}"

# Touch the log so `tail -F` works immediately.
touch /var/log/backup.log

# Run crond in foreground and stream the log alongside.
( crond -f -l 2 -L /var/log/backup.log ) &
CRON_PID=$!

tail -F /var/log/backup.log &
TAIL_PID=$!

# Forward signals for graceful shutdown.
trap 'kill -TERM $CRON_PID $TAIL_PID 2>/dev/null || true' TERM INT

wait $CRON_PID
