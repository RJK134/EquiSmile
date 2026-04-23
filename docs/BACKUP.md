# EquiSmile — Backup & Restore Runbook

The EquiSmile operational database (Postgres 16) is the single source
of truth for customer PII, clinical records, enquiry/appointment state
and the audit trail. A lost or corrupted database is an unrecoverable
business event.

This document is the minimum viable backup + restore runbook for the
single-VPS deployment shape used at go-live.

---

## 1. What we back up

| Item | Coverage | Tool |
|---|---|---|
| Postgres schema + all rows | Full nightly `pg_dump` | `scripts/backup-db.sh` |
| Uploaded clinical attachments (`/app/data/attachments`) | Volume copy | `tar` of the Docker volume |
| `.env` (operator secrets) | Manual, off-box | Password manager / vault |
| n8n workflow JSON | In Git (`n8n/`) | `git` |

The database dump is the critical artefact. Everything else is either
in the repo or operator-managed.

---

## 2. Nightly backup — supported path

`scripts/backup-db.sh` produces a gzipped `pg_dump` into
`$BACKUP_DIR` (default `./backups`) and rotates files older than
`$BACKUP_RETENTION_DAYS` (default 14).

### Recommended crontab (host, VPS deployment)

```cron
# EquiSmile — nightly DB backup at 02:30 UTC
30 2 * * *  /opt/equismile/scripts/backup-db.sh >> /var/log/equismile-backup.log 2>&1
```

### Manual run

```sh
BACKUP_DIR=/var/backups/equismile BACKUP_RETENTION_DAYS=30 scripts/backup-db.sh
```

The script writes a one-line success record to stdout:

```
ok backup=/var/backups/equismile/equismile-20260423T023000Z.sql.gz size_bytes=1284091 retention_days=30
```

### Off-box copy

Always copy the backup off the VPS — a host compromise or a disk
failure must not take the backups with it. Two common options:

- **rclone → S3/B2**
  ```sh
  rclone sync /var/backups/equismile b2:equismile-backups/ --fast-list
  ```
- **rsync → a second VPS or NAS**
  ```sh
  rsync -az --delete /var/backups/equismile/ backupuser@off-box:/srv/equismile/
  ```

Schedule this on the same cron or a few minutes after the pg_dump finishes.

---

## 3. Attachments volume

Clinical attachments (PDFs, scan images) live in the `attachments_data`
Docker volume, mounted at `/app/data/attachments`. Back them up weekly:

```sh
docker run --rm \
  -v equismile_attachments_data:/data:ro \
  -v "$(pwd)/backups":/backup \
  alpine tar -czf "/backup/attachments-$(date -u +%F).tar.gz" -C /data .
```

---

## 4. Restore procedure

> **Rehearse this at least once before go-live.** A backup that has
> never been restored is a wish, not a guarantee.

### 4.1 Restore into a fresh database

```sh
# 1. Bring up just postgres (no app).
docker compose up -d postgres

# 2. Create an empty DB (if you're restoring into a clean VPS).
docker compose exec -T postgres createdb -U equismile equismile_restore

# 3. Pipe the gzipped dump in.
gunzip -c /var/backups/equismile/equismile-20260423T023000Z.sql.gz \
  | docker compose exec -T postgres psql -U equismile -d equismile_restore

# 4. Verify row counts look sane.
docker compose exec -T postgres \
  psql -U equismile -d equismile_restore \
  -c 'SELECT count(*) AS customers FROM "Customer" WHERE "deletedAt" IS NULL;'
```

### 4.2 Swap the restored DB into production

If the restore is validated and you're replacing the current DB:

```sh
# 1. Stop the app so writes don't race.
docker compose stop app migrator

# 2. Rename databases (off-hours only).
docker compose exec -T postgres psql -U equismile -c \
  "ALTER DATABASE equismile RENAME TO equismile_prebroken; \
   ALTER DATABASE equismile_restore RENAME TO equismile;"

# 3. Re-run migrate-deploy to sanity-check schema version.
docker compose run --rm migrator

# 4. Start the app.
docker compose up -d app
```

Always keep the `*_prebroken` database for at least 48 hours before
`DROP`-ing it.

---

## 5. Pre-deploy checklist (once)

- [ ] `scripts/backup-db.sh` runs cleanly on the VPS
- [ ] Cron entry is installed and running (check `/var/log/equismile-backup.log`)
- [ ] Off-box copy target is configured and tested (rclone/rsync)
- [ ] A full restore has been rehearsed on a non-production host
- [ ] `BACKUP_DIR` has ≥ 30 days of free disk (rough budget: gz dump × retention × 2)
- [ ] Backup directory permissions are `700` and owned by the operator user

---

## 6. Recovery objectives

| Objective | Target |
|---|---|
| Recovery Point Objective (RPO) | ≤ 24 hours (nightly dump) |
| Recovery Time Objective (RTO) | ≤ 1 hour on the same VPS |

These are adequate for a single-vet practice. If we scale to multiple
vets / multi-site, upgrade to continuous WAL archiving (PITR).
