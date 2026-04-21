/**
 * GET /api/reminders/check — Check and send due reminders.
 *
 * Called by n8n on a schedule (every 30 min). Session-less — protected
 * by the same `N8N_API_KEY` Bearer-token check as the rest of the n8n
 * integration surface. Fails closed in production when the key is unset.
 */

import { NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { reminderService } from '@/lib/services/reminder.service';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';

// 12/min is ~1 every 5s — more than enough for any sane cron cadence.
const limiter = rateLimiter({ windowMs: 60_000, max: 12 });

export async function GET(request: NextRequest) {
  const rl = limiter.check(clientKeyFromRequest(request, 'reminders'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  try {
    const results = await reminderService.checkAndSendReminders();

    const sent = results.filter((r) => r.sent).length;
    const failed = results.filter((r) => !r.sent).length;

    return successResponse({
      success: true,
      message: `Processed ${results.length} reminders: ${sent} sent, ${failed} failed`,
      data: results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
