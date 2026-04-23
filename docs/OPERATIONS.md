# EquiSmile — Operations Runbook

Operational procedures for running EquiSmile in production. Focuses on
the things that break silently: token rotation, connection-pool
behaviour, and the observability surface.

For day-one installation see [SETUP.md](./SETUP.md) and
[DEPLOYMENT.md](./DEPLOYMENT.md). For backup/restore see
[BACKUP.md](./BACKUP.md).

---

## 1. WhatsApp Business Cloud API — token lifecycle

### 1.1 Token types

EquiSmile uses Meta's WhatsApp Business Cloud API via three credentials:

| Env var | What it is | Typical lifetime | Rotates on |
|---|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | System-user permanent access token (or a 60-day user token during onboarding) | System user: no hard expiry, but can be revoked | Meta-side key revocation; operator-initiated rotation |
| `WHATSAPP_APP_SECRET` | App secret — HMAC key used to verify inbound webhook signatures | App lifetime | Only if suspected compromise |
| `WHATSAPP_VERIFY_TOKEN` | Operator-chosen random string; Meta echoes it during webhook verification GET | App lifetime | Only on webhook URL change |

The `WHATSAPP_ACCESS_TOKEN` is the only one that realistically changes
in normal operation.

### 1.2 How to mint a permanent token

Use a **System User** access token, not a personal one. Personal tokens
expire after 60 days — that's a silent outage waiting to happen.

1. In Meta Business Suite: **Business settings → Users → System users**.
2. Create a system user with role "Admin" on the WhatsApp Business
   account.
3. Generate a new token, scope: `whatsapp_business_messaging`,
   `whatsapp_business_management`. Set "Never" for expiry.
4. Copy the token to your password vault **before leaving the page** —
   Meta never shows it again.
5. Paste into `.env` as `WHATSAPP_ACCESS_TOKEN=...`.
6. Restart the app container: `docker compose up -d app`.
7. Verify: `curl -fsS https://<host>/api/health | jq .whatsapp` should
   show `"status":"configured"`.

### 1.3 Rotation procedure (planned)

Run this at least annually, or whenever a staff member with Meta
Business access leaves the practice.

1. Mint a new system-user token in Meta Business Suite.
2. Update `.env` — replace `WHATSAPP_ACCESS_TOKEN` with the new value.
3. `docker compose up -d app` (restart so env var is picked up).
4. `curl -fsS https://<host>/api/health | jq .whatsapp`.
5. Send a test message via `/demo/whatsapp` or a confirmation flow.
6. In Meta Business Suite, revoke the **old** token — do this only
   after confirming the new one works, so you always have a fallback.

### 1.4 Emergency revocation

If the token is suspected to be leaked:

1. Revoke the token in Meta Business Suite → System users → Tokens.
2. Set `WHATSAPP_ACCESS_TOKEN=` empty in `.env` and restart the app —
   the service fails-closed on outbound sends (see
   `lib/services/whatsapp.service.ts:42`) but inbound webhooks keep
   working because they only use `WHATSAPP_APP_SECRET` for signature
   verification.
3. Mint and install a new token as above.
4. Record the incident in the practice's security log.

### 1.5 Inbound webhook verification

The `WHATSAPP_VERIFY_TOKEN` is only consulted during Meta's initial
GET `/api/webhooks/whatsapp` probe. The `WHATSAPP_APP_SECRET` is
consulted on every POST — it's the HMAC secret that signs the payload.
**Without `WHATSAPP_APP_SECRET` set, every inbound message is rejected
(401)** — see `lib/env.ts` boot-time warning.

---

## 2. Postgres connection pool tuning

EquiSmile uses Prisma's default connection pool. For a single-VPS
single-app deployment the defaults are generally fine, but there are
two knobs that matter in production and one that causes silent hangs.

### 2.1 Default behaviour

Prisma picks a pool size using the formula:

```
connection_limit = num_physical_cpus * 2 + 1
```

On the recommended 2 vCPU VPS, that's **5 connections** per app
container. With a single app container this is well below Postgres 16's
default `max_connections = 100`.

### 2.2 Tuning via DATABASE_URL

Both values go on the query string of `DATABASE_URL`:

```
postgresql://equismile:<password>@postgres:5432/equismile?connection_limit=10&pool_timeout=20
```

| Param | Recommended (single-VPS) | What it controls |
|---|---|---|
| `connection_limit` | `10` | Hard cap on pool size. Lifting above ~20 gains little — the DB is usually the bottleneck, not the app. |
| `pool_timeout` | `20` (seconds) | How long a query waits for a connection before giving up. Keep it in the tens of seconds so a brief spike queues instead of 500-ing. |
| `statement_timeout` | `15000` (ms, Postgres-side) | Guard against a slow query stalling the whole pool. Set via `ALTER DATABASE equismile SET statement_timeout = 15000;` once at install time. |

### 2.3 Postgres side

Inside the `postgres` compose service:

```
# docker compose exec -T postgres psql -U equismile -c "SHOW max_connections;"
```

If you run multiple app containers (horizontal scale), the sum of
per-app `connection_limit` must not exceed
`max_connections - 10` (reserve 10 for n8n / migrator / operator
sessions). The single-VPS single-app shape never hits this ceiling.

### 2.4 Diagnosing pool exhaustion

Symptoms:
- `Timed out fetching a new connection from the connection pool`
  errors in the app logs.
- Latency p95 climbs but DB CPU is idle — queries are waiting on the
  app-side pool.

Check pool size at runtime via the health endpoint — `/api/health`
reports DB latency; consistent >250ms on a simple check usually means
pool starvation, not a slow DB.

Short-term fix: raise `connection_limit` by 5 and restart. Long-term
fix: profile and fix the slow query.

### 2.5 Schema migration safety

Migrations run in the `migrator` compose service (see Dockerfile
`migrator` stage). It connects with the same `DATABASE_URL`. Keep
migrations additive (see `docs/migration-safety.md`) — destructive
migrations hold an `ACCESS EXCLUSIVE` lock and can block the whole pool
for the duration.

---

## 3. Observability surface

- `/api/health` — Liveness + dependency check. Returns 200 when healthy,
  503 when any required dependency is unreachable. Point an uptime
  monitor here.
- `/api/status` — Diagnostic snapshot (operator-only, session gated).
- Structured JSON logs on stdout (production). Pipe into a log
  aggregator; `lib/utils/logger.ts` supports an `ErrorSink` for
  Sentry/Highlight integration.
- Security audit entries in the `SecurityAuditLog` table capture every
  sensitive mutation (role changes, exports, deletions, vision
  analysis). Query it for compliance evidence.
