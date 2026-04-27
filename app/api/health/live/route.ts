import { NextResponse } from 'next/server';

import { APP_VERSION } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health/live — liveness probe.
 *
 * Cheapest possible answer: "the process is up". No DB hit, no fetch,
 * no env var reads beyond the build-time `APP_VERSION`. The fact that
 * Next.js routed the request and this handler returned at all proves
 * the answer.
 *
 * Use this from:
 *  - Kubernetes/orchestrator livenessProbe — restart on failure.
 *  - Uptime monitors that should ONLY alert when the process is
 *    completely down (not when n8n is flaky or Postgres is briefly
 *    saturated). For dependency-aware alerting use `/api/health/ready`.
 *
 * Always returns 200 with a stable, tiny JSON body. Public route —
 * exempted in `middleware.ts` via the `^/api/health(/.*)?$` pattern,
 * and auth-gated routes never reach here.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'live',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}

/** HEAD support for monitors that prefer it (saves a body). */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
