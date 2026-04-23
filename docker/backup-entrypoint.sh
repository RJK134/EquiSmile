#!/bin/sh
#
# Entrypoint for the `backup` compose service.
#
# Runs pg_dump against the compose postgres service on `$BACKUP_CRON`
# (default: daily at 02:30 UTC) and leaves the gzipped dumps in the
# mounted `/backups` volume. Retention is managed inline
# (`BACKUP_RETENTION_DAYS`).
#
# The service image is `postgres:16-alpine` so `pg_dump` matches the
# server version exactly — keeps the operator out of pg_dump-vs-server
# version-mismatch territory.
#
# Implementation note: BusyBox crond (Alpine) parses crontab entries
# one line at a time. The backup sequence (dump → rotate → log)
# therefore lives in a dedicated `/usr/local/bin/do-backup.sh` and the
# crontab entry is a SINGLE-LINE invocation. Earlier versions
# interpolated a multi-line heredoc into the crontab directly, which
# silently produced a broken schedule.

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

# Write the per-run backup script. Crond will invoke this as
# `/usr/local/bin/do-backup.sh` on every tick.
BACKUP_SCRIPT=/usr/local/bin/do-backup.sh
cat > "${BACKUP_SCRIPT}" <<EOF
#!/bin/sh
set -eu
export PGPASSWORD='${POSTGRES_PASSWORD}'
TS=\$(date -u +%Y%m%dT%H%M%SZ)
OUT="${BACKUP_DIR}/equismile-\${TS}.sql.gz"
pg_dump -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} -d ${POSTGRES_DB} | gzip -9 > "\$OUT"
find ${BACKUP_DIR} -maxdepth 1 -type f -name 'equismile-*.sql.gz' -mtime +${BACKUP_RETENTION_DAYS} -delete
SIZE=\$(stat -c%s "\$OUT" 2>/dev/null || wc -c < "\$OUT")
echo "ok backup=\$OUT size_bytes=\$SIZE retention_days=${BACKUP_RETENTION_DAYS}"
EOF
chmod +x "${BACKUP_SCRIPT}"

# Write a single-line crontab that just invokes the script. Any log
# output from the script ends up in /var/log/backup.log via the cron
# redirection.
CRONTAB_FILE=/etc/crontabs/root
printf '%s %s >> /var/log/backup.log 2>&1\n' \
  "${BACKUP_CRON}" "${BACKUP_SCRIPT}" > "${CRONTAB_FILE}"

# Always log a startup line so operators can `docker compose logs backup`
# and see the service is alive and the schedule is correct.
echo "[backup] scheduler online cron='${BACKUP_CRON}' retention=${BACKUP_RETENTION_DAYS}d dir=${BACKUP_DIR}"

# Touch the log so `tail -F` works immediately.
touch /var/log/backup.log

# Run crond in foreground and stream the log alongside.
crond -f -l 2 -L /var/log/backup.log &
CRON_PID=$!

tail -F /var/log/backup.log &
TAIL_PID=$!

# Forward signals for graceful shutdown.
trap 'kill -TERM $CRON_PID $TAIL_PID 2>/dev/null || true' TERM INT

wait $CRON_PID
