# Production Readiness Checklist

Complete all items before go-live. Run `npm run validate-env` to verify automated checks.

## Infrastructure

- [ ] Server meets minimum requirements (2 vCPU, 4 GB RAM, 40 GB SSD)
- [ ] Docker and Docker Compose installed
- [ ] SSL/TLS certificate obtained for production domain
- [ ] DNS A record pointing to production server
- [ ] Firewall rules: 80/443 (app), 5678 (n8n — internal only)

## Database

- [ ] All environment variables configured (see `.env.example`)
- [ ] Database migrations applied (`npx prisma migrate deploy`)
- [ ] Seed data cleared / production data loaded
- [ ] Database backup strategy configured (pg_dump cron or managed backups)
- [ ] Database connection pooling configured for production load

## Application

- [ ] `npm run build` succeeds on production
- [ ] Docker Compose running and healthy (`docker compose ps`)
- [ ] Health check returns OK at `/api/health`
- [ ] `npm run validate-env` reports READY
- [ ] PWA manifest URLs updated for production domain (`NEXT_PUBLIC_APP_URL`)
- [ ] CORS configured for production domain
- [ ] Rate limiting configured (reverse proxy or middleware)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)

## External Services

- [ ] WhatsApp Business API verified and webhook URL configured
- [ ] SMTP/email credentials verified and sending works
- [ ] Google Maps API keys active with appropriate restrictions
- [ ] n8n workflows imported and credentials configured
- [ ] n8n webhook URLs point to production app

## Monitoring & Alerting

- [ ] Application logging configured (structured JSON to file or log aggregator)
- [ ] Health check monitoring (uptime check on `/api/health`)
- [ ] Database monitoring (connection count, query latency)
- [ ] Disk space monitoring
- [ ] Alerting configured for critical failures

## Security

- [ ] Default passwords changed (database, n8n)
- [ ] API keys rotated from UAT to production values
- [ ] WhatsApp webhook signature verification enabled (`WHATSAPP_APP_SECRET` set)
- [ ] **`N8N_API_KEY` is set** — without it, `/api/webhooks/email`, `/api/n8n/*`, and `/api/reminders/check` fail-close with HTTP 500 outside demo mode
- [ ] n8n basic auth credentials are strong
- [ ] `.env` file permissions restricted (600)
- [ ] No secrets committed to repository
- [ ] `ALLOWED_GITHUB_LOGINS` populated with the minimal vet/admin entries — **empty list denies every sign-in**
- [ ] At least one staff row has `role = admin` and is linked to an Auth.js user via `Staff.userId` (required for exports, role changes, and customer/yard/horse deletions)
- [ ] Security-sensitive operations (exports, attachment download/delete, clinical record mutations, role changes, customer/yard/horse deletions, vision-analysis invocations) verified to appear in `SecurityAuditLog` during staging smoke tests

## Backup & Recovery

- [ ] Database backup schedule active
- [ ] Backup restore tested at least once
- [ ] Rollback procedure documented and tested
- [ ] n8n workflow export saved

## Final Verification

- [ ] End-to-end flow tested: enquiry → triage → route → booking → confirmation
- [ ] Bilingual flow tested (EN and FR customer)
- [ ] Mobile PWA tested on real device
- [ ] Performance acceptable under expected load
- [ ] Business owner sign-off obtained
