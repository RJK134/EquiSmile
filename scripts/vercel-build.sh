#!/usr/bin/env bash
# Vercel build entrypoint.
#
# Hooked from `vercel.json`'s `buildCommand` so the build pipeline
# does the right thing in each Vercel environment without forcing
# the operator to override settings in the dashboard.
#
# Phases:
#   1. Always — `prisma generate` so @prisma/client is built against
#      the committed schema.prisma. Cheap, idempotent, prevents the
#      classic "Prisma Client did not initialize yet" runtime error.
#   2. Preview only — `prisma migrate deploy` + (when DEMO_MODE=true)
#      `prisma db seed`. Lets a reviewer click the Vercel preview
#      URL on a PR and immediately interact with seeded data, no
#      manual setup. Requires VERCEL_PREVIEW_MIGRATE=true to be set
#      explicitly, preventing accidental migration against a production
#      DATABASE_URL that previews may inherit before Neon is configured.
#      Production deploys deliberately skip this so operators run
#      migrations from CI before promotion.
#   3. Always — `next build`. Standard Next.js production build.
#
# Failure handling:
#   - Hard-fail on any non-zero exit (`set -e`). A failed migration
#     or seed aborts the build immediately — the operator sees a clear
#     build failure rather than a green preview with a broken DB.
#   - Log every meaningful step so the Vercel build log is debuggable.
#   - When VERCEL_ENV=preview but DATABASE_URL is unset, log a clear
#     error and let `next build` propagate the failure — the app
#     validates DATABASE_URL at import time, so the build will fail.
#     This keeps the error visible rather than hiding it behind a
#     misleading "successful" deploy.

set -euo pipefail

log() {
  printf '\n[vercel-build] %s\n' "$*"
}

# ─── 1. Prisma client ──────────────────────────────────────────────
log "Generating Prisma client (always)…"
npx prisma generate

# ─── 2. Preview-only DB bootstrap ──────────────────────────────────
if [ "${VERCEL_ENV:-}" = "preview" ]; then
  # Require explicit opt-in to prevent accidental migration against an
  # inherited production DATABASE_URL.  Without the Neon integration
  # (or a Preview-scoped DATABASE_URL override), Vercel passes the
  # production URL to preview builds.  Allowing automatic migrations in
  # that state would apply feature-branch schema changes to live data.
  #
  # Set VERCEL_PREVIEW_MIGRATE=true ONLY after you have confirmed that
  # DATABASE_URL for the Preview environment points to a preview-only DB
  # (e.g. via the Neon Vercel integration — see docs/VERCEL.md §5.1).
  if [ "${VERCEL_PREVIEW_MIGRATE:-}" != "true" ]; then
    log "VERCEL_PREVIEW_MIGRATE is not set to 'true' — skipping DB bootstrap."
    log "Set VERCEL_PREVIEW_MIGRATE=true on the Preview environment in Vercel"
    log "project settings ONLY after configuring a preview-specific DATABASE_URL"
    log "(e.g. via the Neon Vercel integration). Without an isolated preview DB,"
    log "running prisma migrate deploy here would mutate the production database."
  elif [ -z "${DATABASE_URL:-}" ]; then
    log "WARNING: DATABASE_URL is unset — skipping migrate + seed."
    log "         next build will fail: DATABASE_URL is required by the"
    log "         application and validated at import time (lib/env.ts)."
    log "         Install the Neon Vercel integration or set a Preview-only"
    log "         DATABASE_URL in Vercel project settings, then redeploy."
  else
    log "VERCEL_PREVIEW_MIGRATE=true and DATABASE_URL set — running preview-DB bootstrap"
    log "Running prisma migrate deploy…"
    npx prisma migrate deploy

    if [ "${DEMO_MODE:-}" = "true" ]; then
      log "DEMO_MODE=true — running demo seed…"
      log "NOTE: seed uses upserts that overwrite existing rows to canonical"
      log "      demo state. Edits to seeded records won't survive redeployment."
      npx prisma db seed
    else
      log "DEMO_MODE not 'true' — skipping seed. Set DEMO_MODE=true on the"
      log "Preview environment in Vercel project settings to enable the"
      log "persona picker + simulated WhatsApp/email integrations."
    fi
  fi
else
  log "VERCEL_ENV=${VERCEL_ENV:-unset} — skipping preview-DB bootstrap"
  log "(production migrations should run from CI before this build)"
fi

# ─── 3. Next.js build ──────────────────────────────────────────────
log "Building Next.js application…"
npx next build

log "Build complete."
