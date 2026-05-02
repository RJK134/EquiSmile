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
#      manual setup. Production deploys deliberately skip this so
#      operators run migrations from CI before promotion.
#   3. Always — `next build`. Standard Next.js production build.
#
# Failure handling:
#   - Hard-fail on any non-zero exit (`set -euo pipefail`). A failed migration
#     or seed aborts the build immediately — the operator sees a clear
#     build failure rather than a green preview with a broken DB.
#   - Log every meaningful step so the Vercel build log is debuggable.
#   - When VERCEL_ENV=preview but DATABASE_URL is unset, skip the
#     migrate+seed step with a loud warning rather than crashing —
#     the operator can still see the static rendered HTML.
#
# ⚠ PRODUCTION DATABASE WARNING: DATABASE_URL for preview deploys
#   MUST point to a preview-only database — NOT the production database.
#   The script auto-runs `prisma migrate deploy` (and seed) on every
#   preview build. Install the Neon Vercel integration (Marketplace →
#   Neon) to get per-PR isolated branch databases automatically, or
#   configure a separate Preview-environment DATABASE_URL in Vercel
#   project settings with the "Production" checkbox unticked.

set -euo pipefail

log() {
  printf '\n[vercel-build] %s\n' "$*"
}

# ─── 1. Prisma client ──────────────────────────────────────────────
log "Generating Prisma client (always)…"
npx prisma generate

# ─── 2. Preview-only DB bootstrap ──────────────────────────────────
if [ "${VERCEL_ENV:-}" = "preview" ]; then
  log "VERCEL_ENV=preview — running preview-DB bootstrap"

  if [ -z "${DATABASE_URL:-}" ]; then
    log "WARNING: DATABASE_URL is unset; skipping migrate + seed."
    log "         Preview will render but DB-backed pages will 5xx."
    log "         Install the Neon Vercel integration or set a"
    log "         Preview-only DATABASE_URL in Vercel project settings."
  else
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
