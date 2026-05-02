# Vercel deployment guide

EquiSmile deploys cleanly on Vercel via the [Vercel for GitHub
integration](https://vercel.com/docs/git/vercel-for-github). This
file documents what the integration needs from the operator and
why the repo is structured the way it is.

For local Docker / single-VPS deploys see [DEPLOYMENT.md](./DEPLOYMENT.md)
and [OPERATIONS.md](./OPERATIONS.md). The Docker stack and Vercel
deploys are mutually independent — pick one per environment.

---

## 1. One-time project setup

1. Create a new Vercel project from the **`rjk134/equismile`** GitHub
   repo. Vercel auto-detects Next.js.
2. Vercel will respect the `vercel.json` at the repo root:
   - **Framework**: `nextjs` (explicit, also auto-detected).
   - **Build Command**: `prisma generate && next build` (Prisma client
     must exist before `next build` walks the codebase).
   - **Install Command**: `npm install --no-audit --no-fund` (keeps the
     log readable; `postinstall` script also runs `prisma generate`
     as a belt-and-braces guard).
   - **Region**: `fra1` (Frankfurt — closest to the Vaud-based
     practice; lowest p95 to Swiss customers).
   - **GitHub auto-cancellation**: enabled (a fresh push cancels the
     previous in-flight preview build).
   - **Branch deployments**: only `main` triggers production; other
     branches get preview URLs.
   - Default response headers (HSTS-equivalent, frame-ancestors,
     no-sniff, restrictive Permissions-Policy) are layered on top
     of the `lib/security/headers.ts` middleware so the protections
     survive any route that bypasses middleware.
3. Set every env var listed in §2 in **Project Settings → Environment
   Variables**. Mark each one for the environments it applies to
   (`Production`, `Preview`, `Development`). The dashboard checkbox
   labelled **Sensitive** should be ticked for every secret.

## 2. Required environment variables

Group A — **always required** (production + preview):

| Var | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Postgres connection | Use a Vercel-region-local managed Postgres. **Recommended**: [Neon](https://neon.tech) (`postgresql://USER:PASS@HOST/DB?sslmode=require&pool_timeout=20&connection_limit=10`) — branch-DB pricing matches Vercel's preview deploys. **Alternatives**: Supabase, Railway, RDS. |
| `AUTH_SECRET` | Auth.js JWT/session secret | `openssl rand -base64 32`. **Different value per environment** to prevent session bleed between preview and production. |
| `AUTH_URL` | Auth.js callback origin | Production: `https://app.example.com`. Preview: leave unset and Vercel populates `VERCEL_URL` automatically; Auth.js's `trustHost` handles the preview-domain rotation. |
| `NEXT_PUBLIC_APP_URL` | CORS allow-list anchor | Production custom domain only. |
| `N8N_API_KEY` | Server-to-server n8n auth | Required even on preview — every webhook handler fail-closes when unset (per `KNOWN_ISSUES.md` KI-006). |

Group B — **integration creds** (production):

| Var | Used by |
|---|---|
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | `lib/integrations/whatsapp.client.ts` |
| `GOOGLE_MAPS_API_KEY`, `GCP_PROJECT_ID`, `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Geocoding + Route Optimization + map tiles |
| `ANTHROPIC_API_KEY`, `EQUISMILE_VISION_MODEL` (optional) | Vision pipeline (Phase 13) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Outbound email + monthly finance report |

Group C — **finance configuration** (production, when invoicing live customers):

| Var | Purpose |
|---|---|
| `EQUISMILE_PRACTICE_NAME` | Creditor name on Swiss QR-bills |
| `EQUISMILE_PRACTICE_ADDRESS`, `EQUISMILE_PRACTICE_BUILDING`, `EQUISMILE_PRACTICE_ZIP`, `EQUISMILE_PRACTICE_CITY`, `EQUISMILE_PRACTICE_COUNTRY` | Creditor address |
| `EQUISMILE_PRACTICE_IBAN` | Swiss QR-IBAN |
| `EQUISMILE_FINANCE_REPORT_RECIPIENTS` | Comma-separated emails for the monthly accounting export |

When `DEMO_MODE=true` the finance / Maps clients fall back to safe
placeholder values; demo previews don't need Group C set.

Group D — **demo / preview overrides**:

| Var | Purpose |
|---|---|
| `DEMO_MODE` | Set to `true` on **preview** deployments only. Enables `/api/demo/sign-in`, the persona picker, and the WhatsApp / email simulators. **Never set in production.** |
| `EQUISMILE_LIVE_MAPS` | Set to `true` only when a preview demo wants real Google Maps calls (consumes live billing). |
| `NEXT_PUBLIC_BUILD_SHA` | Optional. Vercel exposes `VERCEL_GIT_COMMIT_SHA` automatically; the login footer reads either, so this can stay unset. |

## 3. Build pipeline

The build runs in this order on Vercel:

```
1. install:   npm install --no-audit --no-fund
                └── postinstall: prisma generate
2. build:     prisma generate && next build
                ↑ redundant prisma generate is idempotent and ~80ms
                ↑ uses DATABASE_URL only for the schema; no DB hit
3. deploy:    Vercel uploads .next + serverless functions
```

**Why `prisma generate` runs twice.** The `postinstall` hook covers
Vercel's default install path; the explicit `buildCommand` covers
the case where an operator overrides `installCommand` in the
dashboard. Running `prisma generate` twice is cheap (~80ms) and
prevents the "Prisma Client did not initialize yet" runtime error
that bites when the client folder is missing.

**The `output: 'standalone'` setting in `next.config.ts` is
ignored by Vercel** (used only by Docker). Don't remove it — the
Docker build relies on it.

## 4. Database migrations

Vercel does **not** run `prisma migrate deploy` automatically. You
have three options:

1. **Recommended for production** — run migrations from CI before
   the Vercel deploy:
   ```yaml
   # .github/workflows/migrate-and-deploy.yml (sketch)
   - run: npx prisma migrate deploy
     env:
       DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
   ```
2. **For Neon previews** — point each preview deploy at a fresh
   Neon branch (auto-created via Neon's GitHub app) and let Prisma's
   migrate-on-startup handle the new branch. Add a one-shot script
   to a Vercel Cron or Edge function if needed.
3. **Manual** — run `npx prisma migrate deploy` against the prod DB
   from a developer laptop on every deploy. Not recommended.

## 5. Preview deployments

Every push to a non-`main` branch creates a unique preview URL
served at `https://equismile-git-<branch>-<team>.vercel.app`.
Each preview is fully isolated (separate sandbox, separate env),
but **shares the production `DATABASE_URL` unless you override
it per-environment**. For destructive testing use a Neon preview
branch DB.

The `vercel-for-github` integration comments preview URLs onto each
PR (visible as the **`Vercel Preview Comments`** check the repo
already shows). Cancellation behaviour is on by default — a new push
to the same branch cancels the in-flight build.

## 6. Custom domain rollout

When the practice's real domain is ready:

1. **Project Settings → Domains** → add `app.equismile.ch` (or your
   chosen subdomain).
2. Verify the DNS via the CNAME or `A`/`AAAA` rows Vercel prints.
3. Update `NEXT_PUBLIC_APP_URL` and `AUTH_URL` to match the new
   origin. Re-deploy.
4. Update the GitHub OAuth app's callback URL (Settings → OAuth Apps
   → EquiSmile) to `https://app.equismile.ch/api/auth/callback/github`.

## 7. Known limitations

- **No CAMT.054 file uploads >5 MB**: the `/api/finance/imports` route
  reads the JSON body in memory; Vercel serverless function payload
  limit is 4.5 MB. For larger statements, run the import via the
  Docker stack or migrate the route to `runtime: 'nodejs'` + chunked
  upload.
- **PDFKit cold-starts**: the Swiss QR-bill PDF route uses PDFKit
  (server-side font loading). First request per region after a cold
  deploy can take 600–900 ms; subsequent requests are <150 ms.
- **`output: 'standalone'`** is ignored by Vercel — see §3.

## 8. Quick verification after deploy

```sh
# Health gate
curl -fsS https://<your-vercel-url>/api/health | jq .

# Should show:
#   checks.database.status: "up"
#   checks.environment.status: "ok"   (or "degraded" with a missing[] list)

# QR-bill smoke (after seeding at least one invoice)
curl -fsS -o test.pdf https://<your-vercel-url>/api/invoices/<id>/qr-bill.pdf
file test.pdf  # should print "PDF document, version 1.x"
```

If `/api/health` returns 503: check the `missing[]` field in the env
section, populate the gap in Vercel's env-var dashboard, and
redeploy.
