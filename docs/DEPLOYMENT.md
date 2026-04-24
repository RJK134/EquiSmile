# Deployment Guide

Step-by-step guide for deploying EquiSmile to production.

## Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Docker | 24+ | Latest |
| Docker Compose | v2+ | Latest |
| Node.js | 20 LTS | 20 LTS |

## 1. Clone Repository and Checkout Release Tag

```bash
git clone https://github.com/RJK134/EquiSmile.git
cd EquiSmile
git checkout rc/v1.0.0
```

## 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with production values:

```bash
# Required
DATABASE_URL="postgresql://equismile:<strong-password>@postgres:5432/equismile?schema=public"
POSTGRES_USER=equismile
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=equismile

# App URL (your production domain)
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_DEFAULT_LOCALE=en

# n8n (use strong credentials)
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=<admin-username>
N8N_BASIC_AUTH_PASSWORD=<strong-password>
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_HOST=your-domain.com
N8N_API_KEY=<generate-a-uuid>
N8N_WEBHOOK_URL=https://your-domain.com:5678

# WhatsApp (from Meta Business Manager)
WHATSAPP_PHONE_NUMBER_ID=<your-phone-number-id>
WHATSAPP_BUSINESS_ACCOUNT_ID=<your-business-account-id>
WHATSAPP_ACCESS_TOKEN=<your-access-token>
WHATSAPP_VERIFY_TOKEN=<your-verify-token>
WHATSAPP_APP_SECRET=<your-app-secret>

# SMTP
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=<email-user>
SMTP_PASSWORD=<email-password>
SMTP_FROM=noreply@your-domain.com

# Google Maps
GOOGLE_MAPS_API_KEY=<your-api-key>

# Home base for route planning
HOME_BASE_ADDRESS="Your Practice Address, Postcode"
HOME_BASE_LAT=<latitude>
HOME_BASE_LNG=<longitude>

# Backups (built-in compose service; see BACKUP.md)
BACKUP_CRON=30 2 * * *
BACKUP_RETENTION_DAYS=14

# Error tracking — point at any JSON-POST endpoint (Slack incoming
# webhook, a self-hosted log-collector, a Sentry relay). Omit to run
# without remote error tracking (stderr logs still work). See
# OPERATIONS.md §3 + instrumentation.ts.
EQUISMILE_ERROR_WEBHOOK_URL=https://hooks.slack.com/services/...
# Optional bearer token for collectors that need auth.
# EQUISMILE_ERROR_WEBHOOK_TOKEN=
EQUISMILE_ENV=production
```

Restrict file permissions:

```bash
chmod 600 .env
```

## 3. Start Docker Services

```bash
docker compose up -d
```

Verify all services are healthy:

```bash
docker compose ps
```

Expected output: `postgres` and `n8n` both show `healthy`.

## 4. Run Database Migrations

```bash
npx prisma migrate deploy
```

This applies all pending migrations to the production database.

## 5. Validate Environment

```bash
npm run validate-env
```

All required checks should pass. Fix any failures before proceeding.

## 6. Import n8n Workflows

1. Open n8n at `https://your-domain.com:5678`
2. Log in with the admin credentials from `.env`
3. Import each workflow from the `n8n/` directory:
   - `01-whatsapp-intake.json`
   - `02-email-intake.json`
   - `03-auto-triage.json`
   - `04-geocoding.json`
   - `05-route-optimisation.json`
   - `06-confirmations-reminders.json`
4. Activate all imported workflows

## 7. Configure n8n Credentials

In n8n, set up credentials for:

1. **EquiSmile API** — Base URL: `https://your-domain.com`, API key from `N8N_API_KEY`
2. **WhatsApp** — Phone number ID and access token
3. **SMTP** — Host, port, user, password
4. **Google Maps** — API key

## 8. Verify Health Check

```bash
curl https://your-domain.com/api/health
```

Expected response includes status of all services.

## 9. Configure Domain and SSL

### Using a reverse proxy (recommended)

Configure Nginx or Caddy as a reverse proxy:

**Nginx example:**

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-domain.com.pem;
    ssl_certificate_key /etc/ssl/private/your-domain.com.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

## 10. Set Up WhatsApp Webhook URL

In the Meta Business Manager:

1. Go to your WhatsApp app settings
2. Set the webhook URL to: `https://your-domain.com/api/webhooks/whatsapp`
3. Set the verify token to match `WHATSAPP_VERIFY_TOKEN` in `.env`
4. Subscribe to the `messages` webhook field

## 11. Verify End-to-End Flow

1. Send a test WhatsApp message to the business number
2. Verify enquiry appears in the dashboard
3. Check triage processes correctly
4. Verify confirmation can be sent back to customer

---

## Rollback Procedure

If issues are found after deployment:

### Application rollback

```bash
# Stop current version
docker compose down

# Checkout previous stable tag
git checkout <previous-tag>

# Rebuild and restart
docker compose up -d --build
```

### Database rollback

If a migration needs to be reverted:

```bash
# Check current migration state
npx prisma migrate status

# Revert to a specific migration (use with caution)
# See docs/migration-safety.md for per-migration rollback SQL
```

### Emergency rollback

```bash
# Restore database from backup
pg_restore -h localhost -U equismile -d equismile < backup.dump

# Restart application on previous tag
git checkout <previous-tag>
docker compose up -d --build
```

---

## Backup and Restore

Full runbook lives in [`BACKUP.md`](./BACKUP.md). Summary:

### Automated backups (built-in compose service)

The `backup` service defined in `docker-compose.yml` runs `pg_dump` on
an internal cron schedule and rotates gzipped dumps in the
`backups_data` volume. No host cron needed.

```bash
# Bring it up alongside the rest of the stack.
docker compose up -d backup

# Confirm the schedule (expect "[backup] scheduler online cron='…'").
docker compose logs backup | head

# List dumps currently held.
docker compose exec backup ls -lh /backups
```

Tunables (see `.env.example`):

| Variable | Default | What it controls |
|---|---|---|
| `BACKUP_CRON` | `30 2 * * *` | Schedule (UTC, 5-field cron) |
| `BACKUP_RETENTION_DAYS` | `14` | Age-based rotation |

### Off-box copy

A local backup does not survive a host compromise or disk failure.
Copy the volume off-box nightly via rclone/rsync:

```sh
rclone sync /var/lib/docker/volumes/equismile_backups_data/_data \
  b2:equismile-backups/ --fast-list
```

### Weekly restore-verify (recommended)

`scripts/backup-restore-verify.sh` restores the newest dump into a
scratch DB and asserts schema + liveness, then drops the scratch DB.
A backup you never restore is a wish, not a guarantee:

```cron
30 3 * * 0  /opt/equismile/scripts/backup-restore-verify.sh >> /var/log/equismile-backup.log 2>&1
```

### Manual restore

See [`BACKUP.md`](./BACKUP.md) §4 for the full step-by-step (restore
into scratch DB, validate, rename swap). Never restore directly over
the live DB without a preceding backup snapshot.

### n8n workflow backup

Workflows live in `n8n/` under version control. Export from the n8n
UI or CLI after any change and commit the JSON.

---

## Monitoring Setup

### Health check monitoring

Set up an external uptime monitor (e.g., UptimeRobot, Pingdom) to check:

- `https://your-domain.com/api/health` — every 5 minutes
- Alert on 2+ consecutive failures

### Admin observability dashboard

Signed-in admin users reach `/{en,fr}/admin/observability` (and the
equivalent `GET /api/admin/observability` JSON for scripts). This
surfaces, at a glance:

- Dead-letter queue depth (permanent failures awaiting operator action)
- `SecurityAuditLog` activity over the last 24 h and sign-in-denied count
- Backup freshness — newest dump's age, size, total file count, stale flag

Use it as the first port of call during an incident instead of sshing
onto the VPS.

### Error tracking sink

Set `EQUISMILE_ERROR_WEBHOOK_URL` (+ optional `EQUISMILE_ERROR_WEBHOOK_TOKEN`)
to forward every `logger.error()` to any JSON-POST endpoint — Slack
incoming webhook, Sentry relay, self-hosted log aggregator. Events are
fire-and-forget, deduped in a 60-second window, and PII-scrubbed via
`redact()` before leaving the container. See
[`OPERATIONS.md`](./OPERATIONS.md) §3.

### Log monitoring

Application logs are structured JSON on stdout, collected by Docker's
json-file driver (rotated at 10 MB × 5 files per service — 50 MB
ceiling). Configure a log aggregator if you want cross-service search:

```bash
# View application logs
docker compose logs -f app

# View database logs
docker compose logs -f postgres

# View n8n logs
docker compose logs -f n8n

# View the scheduled backup service logs (prints "ok backup=…" lines)
docker compose logs -f backup
```

### Resource monitoring

Monitor server resources:

```bash
# Docker resource usage
docker stats

# Disk usage (include the backups and attachments volumes)
df -h
docker system df -v
```

---

## Common Troubleshooting

### App won't start

1. Check logs: `docker compose logs app`
2. Verify `.env` is complete: `npm run validate-env`
3. Check database is healthy: `docker compose ps`
4. Ensure migrations are applied: `npx prisma migrate status`

### Database connection refused

1. Check PostgreSQL is running: `docker compose ps postgres`
2. Verify `DATABASE_URL` in `.env`
3. Check PostgreSQL logs: `docker compose logs postgres`
4. Test connection: `docker exec equismile-postgres pg_isready`

### n8n workflows not triggering

1. Verify n8n is healthy: `docker compose ps n8n`
2. Check workflows are activated in n8n UI
3. Verify webhook URLs point to correct app URL
4. Check n8n execution logs for errors

### WhatsApp messages not received

1. Verify webhook URL in Meta Business Manager
2. Check `WHATSAPP_VERIFY_TOKEN` matches
3. Verify `WHATSAPP_APP_SECRET` for signature validation
4. Check app logs for webhook errors

### Emails not sending

1. Run `npm run validate-env` to check SMTP connectivity
2. Verify SMTP credentials
3. Check spam folders for test emails
4. Review SMTP provider's sending limits
