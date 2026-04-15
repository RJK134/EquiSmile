import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMissingRequiredVars, getN8nBaseUrl } from '@/lib/env';
import { APP_VERSION } from '@/lib/constants';
import type { HealthCheckResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function checkDatabase(): Promise<{
  status: 'up' | 'down';
  latency_ms: number;
}> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'up', latency_ms: Date.now() - start };
  } catch {
    return { status: 'down', latency_ms: Date.now() - start };
  }
}

function checkEnvironment(): {
  status: 'ok' | 'missing';
  missing: string[];
} {
  const missing = getMissingRequiredVars();
  return {
    status: missing.length === 0 ? 'ok' : 'missing',
    missing,
  };
}

async function checkN8n(): Promise<{
  status: 'up' | 'unreachable';
  url: string;
}> {
  const url = getN8nBaseUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${url}/healthz`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return {
      status: response.ok ? 'up' : 'unreachable',
      url,
    };
  } catch {
    return { status: 'unreachable', url };
  }
}

export async function GET() {
  const [database, n8n] = await Promise.all([
    checkDatabase(),
    checkN8n(),
  ]);
  const environment = checkEnvironment();

  const checks = { database, environment, n8n };

  let status: HealthCheckResponse['status'] = 'healthy';
  if (database.status === 'down' || environment.status === 'missing') {
    status = 'unhealthy';
  } else if (n8n.status === 'unreachable') {
    status = 'degraded';
  }

  const body: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    checks,
  };

  return NextResponse.json(body, {
    status: status === 'unhealthy' ? 503 : 200,
  });
}
