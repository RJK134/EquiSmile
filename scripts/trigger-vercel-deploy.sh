#!/usr/bin/env bash
# Trigger a Vercel deploy via the project's deploy hook.
#
# Reads the hook URL from VERCEL_DEPLOY_HOOK_URL — either inherited
# from the shell or sourced from .env.local. The URL contains a
# secret token, so it must NEVER be committed to git.
#
# Usage:
#   bash scripts/trigger-vercel-deploy.sh
#   VERCEL_DEPLOY_HOOK_URL='https://api.vercel.com/...' bash scripts/trigger-vercel-deploy.sh
#
# To set up persistently:
#   1. Get the hook URL from Vercel dashboard → Project Settings →
#      Git → Deploy Hooks → Create Hook (or reuse an existing one).
#   2. Add to .env.local (which is gitignored):
#        VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/prj_.../...
#   3. Run this script.
#
# For automated triggers (e.g. nightly demo refresh), use the
# `.github/workflows/vercel-deploy-trigger.yml` workflow instead —
# same hook URL, stored as the GitHub repo secret of the same name.

set -euo pipefail

# Source .env.local if present and the env var isn't already set.
if [ -z "${VERCEL_DEPLOY_HOOK_URL:-}" ] && [ -f .env.local ]; then
  # Read the line for this var only — avoids issues with other
  # multi-line / special-char env vars in .env.local.
  hook_line=$(grep -E '^VERCEL_DEPLOY_HOOK_URL=' .env.local | head -1 || true)
  if [ -n "$hook_line" ]; then
    VERCEL_DEPLOY_HOOK_URL="${hook_line#VERCEL_DEPLOY_HOOK_URL=}"
    # Strip surrounding quotes if present.
    VERCEL_DEPLOY_HOOK_URL="${VERCEL_DEPLOY_HOOK_URL%\"}"
    VERCEL_DEPLOY_HOOK_URL="${VERCEL_DEPLOY_HOOK_URL#\"}"
    VERCEL_DEPLOY_HOOK_URL="${VERCEL_DEPLOY_HOOK_URL%\'}"
    VERCEL_DEPLOY_HOOK_URL="${VERCEL_DEPLOY_HOOK_URL#\'}"
    export VERCEL_DEPLOY_HOOK_URL
  fi
fi

if [ -z "${VERCEL_DEPLOY_HOOK_URL:-}" ]; then
  cat >&2 <<'EOF'
ERROR: VERCEL_DEPLOY_HOOK_URL is not set.

Add it to .env.local (gitignored) like:
  VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/prj_.../...

Or export it for one run:
  export VERCEL_DEPLOY_HOOK_URL='https://api.vercel.com/...'
  bash scripts/trigger-vercel-deploy.sh

Get the URL from Vercel dashboard → Project Settings → Git → Deploy Hooks.
EOF
  exit 1
fi

echo "Triggering Vercel deploy…"
response=$(curl -fsS -X POST "$VERCEL_DEPLOY_HOOK_URL")
echo "$response"

# Pretty-print if jq is available (most operator laptops have it).
if command -v jq >/dev/null 2>&1; then
  echo
  echo "$response" | jq .
fi

echo
echo "Track progress at: https://vercel.com/dashboard"
