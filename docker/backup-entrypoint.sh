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
# Implementation notes
# --------------------
# 1. BusyBox crond (Alpine) parses crontab entries one line at a time.
#    The backup sequence (dump → rotate → log) therefore lives in a
#    dedicated `/usr/local/bin/do-backup.sh` and the crontab entry is
#    a SINGLE-LINE invocation.
# 2. We never interpolate POSTGRES_PASSWORD into a shell string. Any
#    password value — including ones containing `'`, `"`, `$`, backslash
#    or newline — would break the generated script or, worse, open a
#    shell-injection path. Instead we write a libpq `.pgpass` file at
#    0600 and let `pg_dump` read the secret itself.

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

# ---------------------------------------------------------------------
# Write the libpq password file. Any byte is safe here EXCEPT `:` and
# newline, which are record separators per the .pgpass spec. In
# practice we never accept those in POSTGRES_PASSWORD; fail loud if we
# see them rather than write a broken file silently.
# ---------------------------------------------------------------------

case "${POSTGRES_PASSWORD}" in
  *:*)
    echo "error: POSTGRES_PASSWORD contains ':' which is a .pgpass record separator" >&2
    exit 1 ;;
esac
case "${POSTGRES_PASSWORD}" in
  *"$(printf '\n')"*)
    echo "error: POSTGRES_PASSWORD contains a newline, which is a .pgpass record separator" >&2
    exit 1 ;;
esac

PGPASSFILE="/root/.pgpass"
umask 077
printf '%s:%s:%s:%s:%s\n' \
  "${POSTGRES_HOST}" "${POSTGRES_PORT}" "${POSTGRES_DB}" \
  "${POSTGRES_USER}" "${POSTGRES_PASSWORD}" > "${PGPASSFILE}"
chmod 600 "${PGPASSFILE}"
# libpq requires the HOME env to resolve ~/.pgpass. We pin it
# explicitly so `crond`'s minimal env doesn't override it.
export HOME=/root

# Drop POSTGRES_PASSWORD from the environment of child processes we
# spawn from here onwards — `.pgpass` is the source of truth.
unset POSTGRES_PASSWORD

# ---------------------------------------------------------------------
# Validate non-secret env vars before we splice them into the generated
# backup script. These values are also interpolated into a shell
# literal, so we reject any character that could break the quoting or
# smuggle in an extra command. Narrow whitelists only.
#
#   host/user/db: lowercase letters, digits, `.`, `-`, `_`
#   port / retention-days: digits only
#   backup dir: absolute path — letters, digits, `/`, `.`, `-`, `_`
# ---------------------------------------------------------------------

case "${POSTGRES_HOST}" in *[!a-zA-Z0-9._-]*) echo "error: POSTGRES_HOST has disallowed characters" >&2; exit 1 ;; esac
case "${POSTGRES_USER}" in *[!a-zA-Z0-9._-]*) echo "error: POSTGRES_USER has disallowed characters" >&2; exit 1 ;; esac
case "${POSTGRES_DB}"   in *[!a-zA-Z0-9._-]*) echo "error: POSTGRES_DB has disallowed characters"   >&2; exit 1 ;; esac
case "${POSTGRES_PORT}" in *[!0-9]*) echo "error: POSTGRES_PORT must be numeric" >&2; exit 1 ;; esac
case "${BACKUP_RETENTION_DAYS}" in *[!0-9]*) echo "error: BACKUP_RETENTION_DAYS must be numeric" >&2; exit 1 ;; esac
case "${BACKUP_DIR}" in
  /*) ;;
  *) echo "error: BACKUP_DIR must be an absolute path" >&2; exit 1 ;;
esac
case "${BACKUP_DIR}" in *[!a-zA-Z0-9/._-]*) echo "error: BACKUP_DIR has disallowed characters" >&2; exit 1 ;; esac
# BACKUP_CRON is splice-interpolated into /etc/crontabs/root, so a
# value containing a newline could inject an extra crontab entry. The
# cron vocabulary is digits, `*`, `,`, `-`, `/`, `?`, `L`, `W`, `#`
# plus single spaces and tabs between fields. Anything else is a red
# flag and we fail loud.
case "${BACKUP_CRON}" in *[!0-9*,\-/?LW\#\ ]*)
  echo "error: BACKUP_CRON has disallowed characters" >&2; exit 1 ;;
esac
# Must have exactly five fields (minute hour day-of-month month day-of-week).
cron_field_count=$(printf '%s' "${BACKUP_CRON}" | awk '{print NF}')
if [ "${cron_field_count}" != "5" ]; then
  echo "error: BACKUP_CRON must have 5 fields, got ${cron_field_count}" >&2
  exit 1
fi

# ---------------------------------------------------------------------
# Write the per-run backup script. Crond will invoke this on every tick.
# The script references `.pgpass` via libpq; no password literal lives
# inside its body.
#
# The heredoc is UNQUOTED, so `${VAR}` references expand at write time.
# Every interpolated value below is wrapped in its own double-quoted
# segment of the output script so a value containing a shell
# metacharacter can never change the command structure. The values
# themselves have already been validated above against narrow
# whitelists — this is defence in depth, not the first line of defence.
# ---------------------------------------------------------------------

BACKUP_SCRIPT=/usr/local/bin/do-backup.sh
cat > "${BACKUP_SCRIPT}" <<EOF
#!/bin/sh
set -eu
export HOME=/root
TS=\$(date -u +%Y%m%dT%H%M%SZ)
OUT="${BACKUP_DIR}/equismile-\${TS}.sql.gz"
pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \\
  | gzip -9 > "\$OUT"
find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'equismile-*.sql.gz' -mtime +"${BACKUP_RETENTION_DAYS}" -delete
SIZE=\$(stat -c%s "\$OUT" 2>/dev/null || wc -c < "\$OUT")
echo "ok backup=\$OUT size_bytes=\$SIZE retention_days=${BACKUP_RETENTION_DAYS}"
EOF
chmod +x "${BACKUP_SCRIPT}"

# Single-line crontab entry invoking the script. Crond inherits
# nothing from the parent env, so HOME is re-set inside do-backup.sh
# itself so libpq can find .pgpass.
CRONTAB_FILE=/etc/crontabs/root
printf '%s %s >> /var/log/backup.log 2>&1\n' \
  "${BACKUP_CRON}" "${BACKUP_SCRIPT}" > "${CRONTAB_FILE}"

echo "[backup] scheduler online cron='${BACKUP_CRON}' retention=${BACKUP_RETENTION_DAYS}d dir=${BACKUP_DIR}"

touch /var/log/backup.log

crond -f -l 2 -L /var/log/backup.log &
CRON_PID=$!

tail -F /var/log/backup.log &
TAIL_PID=$!

trap 'kill -TERM $CRON_PID $TAIL_PID 2>/dev/null || true' TERM INT

wait $CRON_PID
