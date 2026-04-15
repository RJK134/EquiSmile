# Migration Safety Guide

## Migration History

All migrations are additive. No columns or tables are dropped.

| Migration | Changes | Rollback Strategy |
|-----------|---------|-------------------|
| `20260415000000_init_equine_vet` | Core schema: Customer, Yard, Horse, Enquiry, EnquiryMessage, VisitRequest | Reverse: drop all tables (full reset only) |
| `20260415100000_phase4_triage_ops` | TriageTask, TriageAuditLog, auto-triage fields on VisitRequest | Drop `TriageTask`, `TriageAuditLog` tables; remove added columns from VisitRequest |
| `20260415200000_phase5_route_planning_fields` | RouteRun, RouteRunStop, geocoding fields on Yard, cluster/planning fields | Drop `RouteRun`, `RouteRunStop` tables; remove added columns from Yard, VisitRequest |
| `20260415000000_phase6_booking_confirmations` | Appointment, VisitOutcome, reminder/confirmation fields | Drop `Appointment`, `VisitOutcome` tables; remove added columns |

## Pre-deployment Checklist

1. Run `npm run preflight` to validate environment and database connectivity
2. Run `npx prisma migrate status` to check pending migrations
3. Take a database backup: `pg_dump -U equismile equismile > backup.sql`
4. Apply migrations: `npx prisma migrate deploy`
5. Verify: `npx prisma validate`

## Rollback Procedure

**Prisma does not support automatic rollback.** To rollback:

1. Identify the failing migration from `npx prisma migrate status`
2. Restore from backup: `psql -U equismile equismile < backup.sql`
3. Mark migration as rolled back: `npx prisma migrate resolve --rolled-back <migration_name>`
4. Fix the migration and re-deploy

## Environment Validation

The app validates environment variables at startup:
- **Required**: `DATABASE_URL` — app fails to start without it
- **Optional**: WhatsApp, SMTP, Google Maps, n8n — app starts but features are disabled
- Run `npm run preflight` to check all validations before deploying
