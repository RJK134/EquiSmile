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
- [ ] Rate limiting configured (middleware is present; confirm production thresholds and any reverse-proxy complement)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options) and verified on live responses

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
- [ ] WhatsApp webhook signature verification enabled
- [ ] `N8N_API_KEY` set for all n8n/email webhook traffic (routes now fail closed without it)
- [ ] n8n basic auth credentials are strong
- [ ] At least one `admin` user / active admin `Staff` record exists for exports, demo controls, and staff management
- [ ] `.env` file permissions restricted (600)
- [ ] No secrets committed to repository

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
