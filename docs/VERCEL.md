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
   - **Build Command**: `bash scripts/vercel-build.sh` (see §3 — this
     handles `prisma generate`, preview-only migrate + seed, and
     `next build` in one script; do **not** override it to
     `prisma generate && next build`, which would bypass the preview
     bootstrap).
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
| `AUTH_URL` | Auth.js callback origin | Production: `https://app.example.com`. Preview: leave unset — when running on Vercel (`VERCEL=1` is set automatically), `trustHost` is automatically enabled so Auth.js uses the request Host header. Only set on Preview if you've added a stable alias or custom domain. |
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
| `VERCEL_PREVIEW_MIGRATE` | Set to `true` on **preview** deployments only, **after** a preview-only `DATABASE_URL` is confirmed (e.g. Neon integration installed). The build script runs `prisma migrate deploy` and (when `DEMO_MODE=true`) `prisma db seed` only when this is `true`. Prevents feature-branch migrations running against an inherited production DB. |
| `DEMO_MODE` | Set to `true` on **preview** deployments only. Enables `/api/demo/sign-in`, the persona picker, and the WhatsApp / email simulators. **Never set in production.** |
| `EQUISMILE_LIVE_MAPS` | Set to `true` only when a preview demo wants real Google Maps calls (consumes live billing). |
| `NEXT_PUBLIC_BUILD_SHA` | Optional. Vercel exposes `VERCEL_GIT_COMMIT_SHA` automatically; the login footer reads either, so this can stay unset. |

## 3. Build pipeline

`vercel.json` calls `bash scripts/vercel-build.sh` for every build.
In the Vercel dashboard, leave the **Build Command** unset so
`vercel.json` stays authoritative, or set it explicitly to
`bash scripts/vercel-build.sh` if you must override it manually.
Do **not** set it to `prisma generate && next build`, because that
bypasses the preview-only migration / seed logic below.

The script branches on `VERCEL_ENV` and `VERCEL_PREVIEW_MIGRATE`:

```
1. install:   npm install --no-audit --no-fund
                └── postinstall: prisma generate
2. build:     bash scripts/vercel-build.sh
                ├── prisma generate   (always — idempotent guard)
                ├── if VERCEL_ENV=preview AND VERCEL_PREVIEW_MIGRATE=true:
                │     prisma migrate deploy   (hard-fails build on error)
                │     if DEMO_MODE=true: npx prisma db seed
                └── next build
3. deploy:    Vercel uploads .next + serverless functions
```

### Why `prisma generate` runs twice

The `postinstall` hook covers Vercel's default install path; the
build script covers the case where an operator overrides
`installCommand` in the dashboard. Running `prisma generate` twice
is cheap (~80ms) and prevents the "Prisma Client did not initialize
yet" runtime error that bites when the client folder is missing.

### Why preview deploys auto-migrate + auto-seed

So a reviewer can click the PR's Vercel comment link and immediately
interact with seeded demo data — no GitHub-OAuth flow, no manual
`prisma migrate deploy` from a developer laptop. Preview deploys run
`prisma migrate deploy` automatically in `scripts/vercel-build.sh`.
**Production deploys deliberately do not use this preview-only path**:
operators run migrations from CI before promotion (see §4).

The seed uses upserts that **overwrite** existing rows to the canonical
demo state on every preview deploy. Edits to seeded records (customers,
horses, appointments, etc.) will not survive the next push — the seed
resets them. This is intentional: each deploy gets a fresh, reproducible
fixture set.

### `output: 'standalone'`

Ignored by Vercel (used only by Docker). Don't remove it from
`next.config.ts` — the Docker build relies on it.

## 4. Database migrations

**Preview deployments**: `scripts/vercel-build.sh` runs
`prisma migrate deploy` automatically on every preview build (see §3).
No manual action needed — the Neon Vercel integration provides the
isolated per-PR branch DB that the script migrates.

**Production deployments**: the build script deliberately skips the
bootstrap when `VERCEL_ENV` is not `preview`. Run migrations from CI
before the Vercel deploy:

```yaml
# .github/workflows/migrate-and-deploy.yml (sketch)
- run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

**Manual fallback**: `npx prisma migrate deploy` against the prod DB
from a developer laptop. Not recommended for regular use.

## 5. Preview deployments

Every push to a non-`main` branch creates a unique preview URL
served at `https://equismile-git-<branch>-<team>.vercel.app`.
Each preview is fully isolated (separate sandbox, separate env),
but **shares the production `DATABASE_URL` unless you override
it per-environment**. For destructive testing use a Neon preview
branch DB (see §5.1).

The `vercel-for-github` integration comments preview URLs onto each
PR (visible as the **`Vercel Preview Comments`** check the repo
already shows). Cancellation behaviour is on by default — a new push
to the same branch cancels the in-flight build.

### 5.1 Recommended Neon Postgres setup (one-time)

[Neon](https://neon.tech) offers per-branch DBs that pair naturally
with Vercel previews. Result: every PR gets its own isolated DB,
auto-created, auto-deleted on PR close.

1. **Vercel Marketplace → Neon** → install integration.
2. During install, link the EquiSmile project. Neon writes
   `DATABASE_URL` (production) and a per-branch override
   (preview) to your Vercel env vars automatically.
3. Untick the "Production" checkbox on the Neon-managed
   `DATABASE_URL` if you already have a production Postgres
   elsewhere — keep it ticked only for Preview.
4. In **Project Settings → Environment Variables**, set
   `VERCEL_PREVIEW_MIGRATE=true` with **only** the "Preview"
   checkbox ticked. This tells the build script it's safe to run
   `prisma migrate deploy` against the now-isolated Neon branch DB.
   **Do not set this variable before step 3 is complete.**

Per-preview behaviour: when a PR opens, Neon creates a branch DB
seeded from the latest production schema. The Vercel preview
deploy hits that branch. When the PR closes, Neon deletes the
branch DB.

### 5.2 Reviewing a PR on Vercel — the operator walkthrough

Once Neon is wired up, `VERCEL_PREVIEW_MIGRATE=true` and `DEMO_MODE=true`
are set on the Preview environment:

1. Open the PR on GitHub.
2. Wait for the **Vercel Preview Comments** check to go green
   (~2 min after push). The bot adds a comment with the preview
   URL: `https://equismile-git-<branch>-<your-team>.vercel.app`.
3. Click the URL. You'll land on `/en/login`.
4. The login page shows the persona-picker because `DEMO_MODE=true`.
   Click **Continue as Demo Vet** (Dr. Kathelijne Deberdt) to enter
   as the practice owner, or expand the picker to sign in as Alex
   (senior vet), Sophie (junior vet), Léa (nurse), or Marc
   (read-only receptionist).
5. The dashboard renders against the seed cohort (15 customers, 8
   yards, 25 horses, 20 invoices across PAID / PARTIAL / OVERDUE
   / OPEN). Every UI surface — triage, planning, route runs,
   appointments, finance — has demo data to interact with.
6. Build SHA is shown in the login footer (sourced from
   `VERCEL_GIT_COMMIT_SHA`) so you can quote the exact commit
   under review when filing feedback.

If the preview URL responds with a 5xx instead of the login card,
check the Vercel deploy log for the `[vercel-build]` script output
— it logs every migrate/seed step. Most common causes:

- `VERCEL_PREVIEW_MIGRATE` not set → the build script skips migrate +
  seed (expected if Neon isn't set up yet). Set `VERCEL_PREVIEW_MIGRATE=true`
  on the Preview environment after confirming a preview-only DB is in place,
  then redeploy.
- `DATABASE_URL` unset on Preview → the build **fails** (the
  application validates `DATABASE_URL` at import time). Add the var
  via the Neon integration or Vercel project settings, then redeploy.
- Migration failure → the **build fails** with a `[vercel-build]` error
  visible in the Vercel build log. Fix the underlying schema issue (e.g.
  conflicting migration state on a stale Neon branch — delete the branch
  DB and let Neon recreate it) then redeploy; `prisma migrate deploy` is
  idempotent.

### 5.3 `.env.preview.example`

The repo ships a [`.env.preview.example`](../.env.preview.example)
template with the minimum vars needed for an interactive preview.
**Copy each var into the Vercel dashboard with the "Preview"
checkbox ticked** — do not commit a real `.env.preview` to git.

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

## 9. Triggering deploys without a code push

Vercel auto-deploys on every push to `main` (and on every push to a
non-`main` branch as a preview). For everything else there's the
**deploy hook** — a project-specific URL that Vercel exposes for
out-of-band triggers.

### Use cases

- **Demo refresh**: re-seed the demo database after manual mutation
  by re-running the build (the build script's `prisma db seed` step
  is idempotent).
- **Recover a stuck deploy** without an empty commit.
- **Scheduled refresh**: nightly cron via the GitHub Action below to
  keep the demo's `daysAgo()` timestamps current.

### One-time setup

1. **Vercel dashboard → Project Settings → Git → Deploy Hooks** →
   create a hook (or reuse an existing one). Copy the URL — it
   contains a secret token.
2. **GitHub repo → Settings → Secrets and variables → Actions →
   New repository secret** → name `VERCEL_DEPLOY_HOOK_URL`, value
   = the URL from step 1. The repo's `.gitignore` covers `.env.local`
   for the local-script case (see below); the URL itself is **never
   committed to git**.
3. **Local laptop** (optional, for `bash scripts/trigger-vercel-deploy.sh`):
   add the same line to `.env.local`:
   ```
   VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/prj_.../...
   ```

### Triggering

| Path | How |
|---|---|
| **GitHub Actions UI** | Repo → Actions tab → "Vercel deploy (manual trigger)" → "Run workflow". Optional `reason` field for the audit trail. |
| **Local laptop** | `bash scripts/trigger-vercel-deploy.sh`. Reads `VERCEL_DEPLOY_HOOK_URL` from `.env.local` or the shell. |
| **Programmatic / curl** | `curl -X POST "$VERCEL_DEPLOY_HOOK_URL"`. |

All three return JSON like `{"job":{"id":"…","state":"PENDING"}}` —
the job ID can be tracked at `https://vercel.com/dashboard`.

### Scheduled refresh (optional)

`.github/workflows/vercel-deploy-trigger.yml` ships with a
commented-out `schedule:` block. Uncomment to enable a daily 06:00 UTC
re-deploy — useful when the demo is being kept "always fresh" for a
long-running pilot. Costs one Vercel build per day plus the Neon
branch-DB writes from re-seeding.


If `/api/health` returns 503: check the `missing[]` field in the env
section, populate the gap in Vercel's env-var dashboard, and
redeploy.
