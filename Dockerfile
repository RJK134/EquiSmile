FROM node:20-alpine AS base

# ─── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

# Generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

# ─── Build ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Accept DATABASE_URL as a build arg so Prisma/Next.js can build without a live DB
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# NEXT_PUBLIC_* vars are inlined into the client JS bundle at build
# time, so they must be in scope during `next build`. Setting them only
# at container runtime leaves empty strings baked into the shipped
# client code — this is what stopped interactive Google Maps working
# in Docker before Phase 15.
ARG NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY}
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ARG NEXT_PUBLIC_DEFAULT_LOCALE
ENV NEXT_PUBLIC_DEFAULT_LOCALE=${NEXT_PUBLIC_DEFAULT_LOCALE}

# Build SHA — surfaced in the demo-mode login footer so UAT testers
# can capture the exact build under test without leaving the page.
# Defaults to "dev" when unset for local development.
ARG NEXT_PUBLIC_BUILD_SHA=dev
ENV NEXT_PUBLIC_BUILD_SHA=${NEXT_PUBLIC_BUILD_SHA}

RUN npm run build

# ─── Migrator ────────────────────────────────────────────────────────────────
FROM base AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma/seed-demo.ts ./prisma/
COPY tsconfig.json ./
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$DEMO_MODE\" = \"true\" ]; then npx tsx prisma/seed-demo.ts; fi"]

# ─── Production ──────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Leverage Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Phase 15 — pre-create the attachments directory owned by the nextjs
# user so the mounted `attachments_data` volume is writable at runtime.
RUN mkdir -p /app/data/attachments && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
