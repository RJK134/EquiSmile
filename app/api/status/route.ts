import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo/demo-mode';
import { googleMapsClient } from '@/lib/integrations/google-maps.client';
import { whatsappClient } from '@/lib/integrations/whatsapp.client';
import { smtpClient } from '@/lib/integrations/smtp.client';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';
import { opsStatusService } from '@/lib/services/ops-status.service';
import { logger } from '@/lib/utils/logger';

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

  return NextResponse.json({
    demoMode: isDemoMode(),
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
