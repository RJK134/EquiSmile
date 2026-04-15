import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMissingRequiredVars, getN8nBaseUrl, env } from '@/lib/env';
import { APP_VERSION } from '@/lib/constants';
import type { HealthCheckResponse } from '@/lib/types';
import { logger, createTimer } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

async function checkDatabase(): Promise<{
  status: 'up' | 'down';
  latency_ms: number;
}> {
  const timer = createTimer();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'up', latency_ms: timer.elapsed() };
  } catch {
    return { status: 'down', latency_ms: timer.elapsed() };
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

async function checkWhatsApp(): Promise<{ status: 'configured' | 'unconfigured' }> {
  const hasCredentials = !!(env.WHATSAPP_PHONE_NUMBER_ID && (env.WHATSAPP_ACCESS_TOKEN || env.WHATSAPP_API_TOKEN));
  return { status: hasCredentials ? 'configured' : 'unconfigured' };
}

async function checkSmtp(): Promise<{ status: 'configured' | 'unconfigured' }> {
  const hasConfig = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
  return { status: hasConfig ? 'configured' : 'unconfigured' };
}

async function checkGoogleMaps(): Promise<{ status: 'configured' | 'unconfigured' }> {
  return { status: env.GOOGLE_MAPS_API_KEY ? 'configured' : 'unconfigured' };
}

export async function GET() {
  const timer = createTimer();

  const [database, n8n, whatsapp, smtp, googleMaps] = await Promise.all([
    checkDatabase(),
    checkN8n(),
    checkWhatsApp(),
    checkSmtp(),
    checkGoogleMaps(),
  ]);
  const environment = checkEnvironment();

  const checks = { database, environment, n8n, whatsapp, smtp, googleMaps };

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

  logger.info('Health check completed', {
    service: 'health',
    operation: 'check',
    status,
    latencyMs: timer.elapsed(),
  } as Record<string, unknown>);

  return NextResponse.json(body, {
    status: status === 'unhealthy' ? 503 : 200,
  });
}
