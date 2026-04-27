import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { env, getN8nBaseUrl } from '@/lib/env';
import { APP_VERSION } from '@/lib/constants';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health/ready — readiness probe.
 *
 * Active liveness check on the dependencies the app needs to serve
 * traffic:
 *  - Postgres reachable (`SELECT 1`)
 *  - n8n reachable (`GET /healthz`, 3 s timeout) when n8n is configured
 *
 * Returns 200 when both dependencies are up and 503 when EITHER is
 * down. Use this from:
 *  - Kubernetes/orchestrator readinessProbe — gate traffic; if not
 *    ready, the orchestrator stops sending requests.
 *  - Uptime monitors that should alert on dependency outages, not
 *    just process death. For pure liveness use `/api/health/live`.
 *
 * Response shape is **deliberately minimal**: per-dependency `up`/`down`
 * plus latency. We do NOT echo n8n URLs, missing env-var names, or
 * any string the operator hasn't already exposed elsewhere — anonymous
 * callers must not be able to enumerate the deployment from this
 * endpoint. The richer, attack-surface-aware view lives at
 * `/api/status` which is admin-gated.
 *
 * Public route — exempted in `middleware.ts` via the
 * `^/api/health(/.*)?$` pattern.
 */

interface DependencyResult {
  status: 'up' | 'down' | 'skipped';
  latencyMs: number;
}

async function probeDatabase(): Promise<DependencyResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (error) {
    logger.warn('readiness: database probe failed', {
      service: 'health-ready',
      operation: 'db-probe',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { status: 'down', latencyMs: Date.now() - start };
  }
}

async function probeN8n(): Promise<DependencyResult> {
  // Treat absence of `N8N_API_KEY` as "n8n is not configured for this
  // deployment" — the same signal `/api/n8n/*` routes use to fail
  // closed. Reporting `skipped` keeps the readiness payload truthful
  // (we're not asserting anything about n8n) without forcing a failed
  // 3-second probe on every poll.
  if (!env.N8N_API_KEY) {
    return { status: 'skipped', latencyMs: 0 };
  }
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${getN8nBaseUrl()}/healthz`, { signal: controller.signal });
    clearTimeout(timeout);
    return {
      status: response.ok ? 'up' : 'down',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    logger.warn('readiness: n8n probe failed', {
      service: 'health-ready',
      operation: 'n8n-probe',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return { status: 'down', latencyMs: Date.now() - start };
  }
}

export async function GET() {
  const [database, n8n] = await Promise.all([probeDatabase(), probeN8n()]);

  // Database is required; n8n is required only when configured.
  // `skipped` does not fail readiness.
  const dbOk = database.status === 'up';
  const n8nOk = n8n.status === 'up' || n8n.status === 'skipped';
  const ready = dbOk && n8nOk;

  return NextResponse.json(
    {
      status: ready ? 'ready' : 'not-ready',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      dependencies: { database, n8n },
    },
    { status: ready ? 200 : 503 },
  );
}

export async function HEAD() {
  // Cheaper variant for orchestrators that only need the status code.
  // Run the same probes so the answer is honest.
  const [database, n8n] = await Promise.all([probeDatabase(), probeN8n()]);
  const dbOk = database.status === 'up';
  const n8nOk = n8n.status === 'up' || n8n.status === 'skipped';
  return new NextResponse(null, { status: dbOk && n8nOk ? 200 : 503 });
}
