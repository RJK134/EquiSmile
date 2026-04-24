# Production Readiness Checklist

Complete all items before go-live. Run `npm run validate-env` to verify automated checks.

See also:
- [`BACKUP.md`](./BACKUP.md) — backup/restore runbook
- [`OPERATIONS.md`](./OPERATIONS.md) — WhatsApp token lifecycle, connection-pool tuning, observability surface
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — step-by-step deploy

## Infrastructure

- [ ] Server meets minimum requirements (2 vCPU, 4 GB RAM, 40 GB SSD)
- [ ] Docker and Docker Compose installed
- [ ] SSL/TLS certificate obtained for production domain
- [ ] DNS A record pointing to production server
- [ ] Firewall rules: 80/443 (app), 5678 (n8n — internal only)

## Database

- [ ] All environment variables configured (see `.env.example`)
- [ ] `POSTGRES_PASSWORD` is strong (compose fails to start if unset; `.env.example` uses a `<strong-password-here>` placeholder)
- [ ] Database migrations applied (`npx prisma migrate deploy` — runs automatically via the `migrator` compose service)
- [ ] Seed data cleared / production data loaded
- [ ] Database backup strategy active — the built-in `backup` compose service runs `pg_dump` on `$BACKUP_CRON` (default 02:30 UTC daily) and rotates by `$BACKUP_RETENTION_DAYS` (default 14). See [`BACKUP.md`](./BACKUP.md)
- [ ] Backup restore tested at least once via `scripts/backup-restore-verify.sh` (see [`BACKUP.md`](./BACKUP.md) §4.1a)
- [ ] Off-box backup copy configured (rclone/rsync to S3/NAS/second VPS)
- [ ] Database connection pooling reviewed for expected load (defaults to `num_cpus*2+1`; see [`OPERATIONS.md`](./OPERATIONS.md) §2 for `connection_limit` / `pool_timeout` tuning)

## Application

- [ ] `npm run build` succeeds on production
- [ ] Docker Compose running and healthy (`docker compose ps`)
- [ ] Health check returns OK at `/api/health`
- [ ] `npm run validate-env` reports READY
- [ ] PWA manifest URLs updated for production domain (`NEXT_PUBLIC_APP_URL`)
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` supplied as a build-time ARG (inlined into client bundles by `next build`)
- [ ] CORS configured for production domain (Caddy/Nginx reverse proxy layer)
- [ ] Rate limiting active — middleware-level 60 s / 120 writes per authenticated user (`middleware.ts`) plus route-specific limits on webhooks, export, vision analyse
- [ ] Security headers configured via `lib/security/headers.ts` (CSP, HSTS, X-Frame-Options, Permissions-Policy, COOP/CORP)
- [ ] Docker log rotation active (`logging.driver: json-file` with `max-size: 10m`, `max-file: 5` per service)

## External Services

- [ ] WhatsApp Business API verified and webhook URL configured
- [ ] WhatsApp token is a **System User** access token (never-expiring), not a 60-day user token — see [`OPERATIONS.md`](./OPERATIONS.md) §1.2
- [ ] WhatsApp rotation procedure rehearsed at least once (see [`OPERATIONS.md`](./OPERATIONS.md) §1.3)
- [ ] SMTP/email credentials verified and sending works
- [ ] Google Maps API keys active with appropriate restrictions
- [ ] n8n workflows imported and credentials configured
- [ ] n8n webhook URLs point to production app

## Monitoring & Alerting

- [ ] Application logging configured (structured JSON to stdout; Docker json-file collects it)
- [ ] Error-tracking sink wired — set `EQUISMILE_ERROR_WEBHOOK_URL` (Slack/Loki/Sentry relay/etc.); `instrumentation.ts` auto-registers the sink at boot
- [ ] Admin observability page (`/[locale]/admin/observability`) reachable and shows live DLQ depth, audit activity, backup freshness
- [ ] Structured logs verified to mask customer contact details and auth/API tokens before shipping off-box
- [ ] Health check monitoring (uptime check on `/api/health`)
- [ ] Database monitoring (connection count, query latency)
- [ ] Disk space monitoring (include `/var/lib/docker/volumes/equismile_backups_data`)
- [ ] Alerting configured for critical failures (webhook sink → chat tool works, or external uptime monitor)

## Security

- [ ] Default passwords changed (database, n8n)
- [ ] API keys rotated from UAT to production values
- [ ] WhatsApp webhook signature verification enabled (`WHATSAPP_APP_SECRET` set)
- [ ] **`N8N_API_KEY` is set** — without it, `/api/webhooks/email`, `/api/n8n/*`, and `/api/reminders/check` fail-close with HTTP 500 outside demo mode
- [ ] n8n basic auth credentials are strong
- [ ] `.env` file permissions restricted (600)
- [ ] No secrets committed to repository (Compose loads secrets from `.env` via `env_file:`; no secret literal lives in `docker-compose.yml`)
- [ ] `ALLOWED_GITHUB_LOGINS` populated with the minimal vet/admin entries — **empty list denies every sign-in**
- [ ] At least one staff row has `role = admin` and is linked to an Auth.js user via `Staff.userId` (required for exports, role changes, and customer/yard/horse deletions)
- [ ] Soft-delete lifecycle understood — Customer/Yard/Horse DELETE tombstones rather than cascading clinical history destruction; hard delete reserved for GDPR/FADP erasure (operator-only)
- [ ] `?includeDeleted=true` on list endpoints is admin-only (silently downgraded for non-admin sessions)
- [ ] Security-sensitive operations (exports, attachment download/delete, clinical record mutations, role changes, customer/yard/horse deletions, vision-analysis invocations, DLQ replay/abandon transitions) verified to appear in `SecurityAuditLog` during staging smoke tests

## Backup & Recovery

- [ ] `backup` compose service running (`docker compose ps backup` shows `Up`; `docker compose logs backup` shows `[backup] scheduler online …`)
- [ ] Backup restore tested at least once (`scripts/backup-restore-verify.sh`)
- [ ] Weekly restore-verify cron scheduled (see [`BACKUP.md`](./BACKUP.md) §4.1a)
- [ ] Attachments volume (`equismile_attachments_data`) backed up on its own schedule (see [`BACKUP.md`](./BACKUP.md) §3)
- [ ] Rollback procedure documented and tested (see [`DEPLOYMENT.md`](./DEPLOYMENT.md) rollback section)
- [ ] n8n workflow export saved

## Final Verification

- [ ] End-to-end flow tested: enquiry → triage → route → booking → confirmation
- [ ] Bilingual flow tested (EN and FR customer)
- [ ] Privacy notice (`/{en,fr}/privacy`) and Terms (`/{en,fr}/terms`) reachable without sign-in (required by Meta WhatsApp Business verification)
- [ ] Mobile PWA tested on real device
- [ ] Performance acceptable under expected load
- [ ] Business owner sign-off obtained
