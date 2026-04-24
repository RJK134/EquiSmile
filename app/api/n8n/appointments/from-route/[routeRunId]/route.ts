/**
 * POST /api/n8n/appointments/from-route/[routeRunId]
 *
 * n8n-authenticated mirror of the VET-session-gated
 * `/api/appointments/from-route/[routeRunId]` endpoint. Used by
 * workflow 06-approval-and-confirmations.json after an operator
 * approves a proposed route run inside the app.
 *
 * Auth: `N8N_API_KEY` Bearer token. Fail-closed in production via
 * `requireN8nApiKey` — no key configured + not in demo mode → 500.
 *
 * Actor attribution: status-history rows attribute to "n8n" rather
 * than the originating operator. The operator approval was already
 * audited by the session-gated route-run approval endpoint; this
 * endpoint exists solely to let automation trigger the booking +
 * confirmation fan-out without carrying an operator cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { bookingService } from '@/lib/services/booking.service';
import { confirmationService } from '@/lib/services/confirmation.service';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';

// Booking + fan-out confirmations is expensive (DB transaction + Meta
// + SMTP calls per appointment). Keep this tight — one approval run
// shouldn't fire more than a couple of times per minute.
const limiter = rateLimiter({ windowMs: 60_000, max: 30 });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ routeRunId: string }> },
): Promise<NextResponse> {
  const rl = limiter.check(clientKeyFromRequest(request, 'n8n-book'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  try {
    const { routeRunId } = await params;
    const bookingResult = await bookingService.bookRouteRun(routeRunId);
    const confirmationResults = await confirmationService.sendConfirmationsForRouteRun(
      routeRunId,
      { actor: 'n8n' },
    );
    return successResponse(
      {
        ...bookingResult,
        confirmations: confirmationResults,
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
