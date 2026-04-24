/**
 * POST /api/n8n/appointments/[id]/cancel
 *
 * n8n-authenticated mirror of the VET-session-gated
 * `/api/appointments/[id]/cancel` endpoint. Used by
 * workflow 06-approval-and-confirmations.json when a customer asks
 * the messaging bot to cancel a booking.
 *
 * Auth: `N8N_API_KEY` Bearer token.
 *
 * Actor attribution: status-history rows attribute to "n8n" — the
 * true originator is the customer inbound message, which is already
 * logged via `appointmentAuditService.logResponse`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { rescheduleService } from '@/lib/services/reschedule.service';
// Reuse the same validation schema as the session-gated twin
// (/api/appointments/[id]/cancel) so the n8n mirror does not silently
// diverge — otherwise a `reason: ""` would be accepted on the browser
// path but rejected here.
import { cancelAppointmentSchema } from '@/lib/validations/appointment.schema';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';

const limiter = rateLimiter({ windowMs: 60_000, max: 60 });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const rl = limiter.check(clientKeyFromRequest(request, 'n8n-cancel'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = cancelAppointmentSchema.parse(body);
    const result = await rescheduleService.cancelAppointment(id, reason, {
      actor: 'n8n',
    });
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
