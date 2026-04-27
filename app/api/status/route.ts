import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo/demo-mode';
import { googleMapsClient } from '@/lib/integrations/google-maps.client';
import { whatsappClient } from '@/lib/integrations/whatsapp.client';
import { smtpClient } from '@/lib/integrations/smtp.client';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';
import { opsStatusService } from '@/lib/services/ops-status.service';
import { logger } from '@/lib/utils/logger';
import { prisma } from '@/lib/prisma';
import { env, getN8nBaseUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/status
 * Admin-only diagnostics. Exposes:
 *
 *   - Integration configuration (booleans, never values).
 *   - Live operational signals (DLQ depth, audit activity, backup
 *     freshness) so the operator can tell at a glance whether anything
 *     needs attention without sshing onto the VPS.
 *
 * Gated by ROLES.ADMIN — the ops snapshot touches row counts for the
 * audit log and the failed-operations queue, neither of which a vet or
 * read-only user has any business reading.
 */
export async function GET() {
  try {
    await requireRole(ROLES.ADMIN);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    throw error;
  }

  let ops: Awaited<ReturnType<typeof opsStatusService.snapshot>> | null = null;
  try {
    ops = await opsStatusService.snapshot();
  } catch (error) {
    // The status surface must never 500. If the ops snapshot blows up
    // (DB down, volume missing, etc.) we still return integration
    // config + log the failure so the operator can investigate.
    logger.error('status: ops snapshot failed', error, { service: 'status' });
  }

  // Phase 16 — active liveness probes. Each probe has its own try/catch
  // so a single broken integration never blanks the whole status page.
  const [database, n8n] = await Promise.all([probeDatabase(), probeN8n()]);
  const whatsappReady = checkWhatsAppReadiness();
  const smtpReady = checkSmtpReadiness();
  const googleMapsReady = checkGoogleMapsReadiness();

  return NextResponse.json({
    demoMode: isDemoMode(),
    probes: {
      database,
      n8n,
      whatsapp: whatsappReady,
      smtp: smtpReady,
      googleMaps: googleMapsReady,
    },
    integrations: {
      googleMaps: googleMapsClient.getMode(),
      whatsapp: whatsappClient.getMode(),
      smtp: smtpClient.getMode(),
    },
    env: {
      DEMO_MODE: process.env.DEMO_MODE ?? '(unset)',
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ? 'set' : 'missing',
      GCP_PROJECT_ID: process.env.GCP_PROJECT_ID ? 'set' : 'missing',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ? 'set' : 'missing',
      WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ? 'set' : 'missing',
      WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET ? 'set' : 'missing',
      SMTP_HOST: process.env.SMTP_HOST ? 'set' : 'missing',
      SMTP_USER: process.env.SMTP_USER ? 'set' : 'missing',
      SMTP_PASSWORD: process.env.SMTP_PASSWORD ? 'set' : 'missing',
      EQUISMILE_ERROR_WEBHOOK_URL: process.env.EQUISMILE_ERROR_WEBHOOK_URL
        ? 'set'
        : 'missing',
    },
    ops,
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Probes — keep them cheap, bounded, and structured. No PII ever ends
// up in the returned payload; failures are summarised, not echoed.
// ---------------------------------------------------------------------------

interface DatabaseProbe {
  status: 'up' | 'down';
  latencyMs: number;
}

async function probeDatabase(): Promise<DatabaseProbe> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (error) {
    logger.warn('status: database probe failed', {
      service: 'status',
      operation: 'db-probe',
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: 'down', latencyMs: Date.now() - start };
  }
}

interface N8nProbe {
  status: 'up' | 'unreachable' | 'unconfigured';
  url: string;
  latencyMs: number;
}

async function probeN8n(): Promise<N8nProbe> {
  const start = Date.now();
  const url = getN8nBaseUrl();
  // `N8N_HOST` cannot be the unconfigured signal — `lib/env.ts` defaults
  // it to `'localhost'`, so it is always truthy and that branch was
  // dead code. The real "n8n is not set up" signal is the absence of
  // `N8N_API_KEY`: every n8n-authenticated callback fails closed
  // without it (see `lib/utils/signature.ts#requireN8nApiKey`), so
  // running active probes against an n8n that has no key is wasted
  // work — and a 3-second timeout per request rather than an honest
  // "unconfigured".
  if (!env.N8N_API_KEY) {
    return { status: 'unconfigured', url, latencyMs: 0 };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${url}/healthz`, { signal: controller.signal });
    clearTimeout(timeout);
    return {
      status: response.ok ? 'up' : 'unreachable',
      url,
      latencyMs: Date.now() - start,
    };
  } catch {
    return { status: 'unreachable', url, latencyMs: Date.now() - start };
  }
}

interface ReadinessProbe {
  status: 'configured' | 'unconfigured';
  /** Operator-friendly summary of which knobs are still missing. */
  missing: string[];
}

function checkWhatsAppReadiness(): ReadinessProbe {
  const required = {
    WHATSAPP_PHONE_NUMBER_ID: env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ACCESS_TOKEN: env.WHATSAPP_ACCESS_TOKEN || env.WHATSAPP_API_TOKEN,
    WHATSAPP_APP_SECRET: env.WHATSAPP_APP_SECRET,
    WHATSAPP_VERIFY_TOKEN: env.WHATSAPP_VERIFY_TOKEN,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return {
    status: missing.length === 0 ? 'configured' : 'unconfigured',
    missing,
  };
}

function checkSmtpReadiness(): ReadinessProbe {
  const required = {
    SMTP_HOST: env.SMTP_HOST,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASSWORD: env.SMTP_PASSWORD,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return {
    status: missing.length === 0 ? 'configured' : 'unconfigured',
    missing,
  };
}

function checkGoogleMapsReadiness(): ReadinessProbe {
  const required = {
    GOOGLE_MAPS_API_KEY: env.GOOGLE_MAPS_API_KEY,
    // Optional for the optimisation API specifically; flag separately
    // so an operator who only needs geocoding doesn't see it as a
    // blocker.
    GCP_PROJECT_ID: env.GCP_PROJECT_ID,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return {
    status: missing.length === 0 ? 'configured' : 'unconfigured',
    missing,
  };
}
