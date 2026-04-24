/**
 * POST /api/appointments/from-route/[routeRunId] — Convert approved route
 * to appointments.
 *
 * VET+ only. Booking is a customer-facing commitment: it creates
 * appointments, locks the visit-requests to BOOKED, and dispatches
 * confirmations. Readonly sessions must not be able to trigger it.
 *
 * NB: n8n automation no longer calls this session-gated URL. It hits
 * the API-key-gated `/api/n8n/appointments/from-route/[routeRunId]`
 * mirror instead — see workflow 06-approval-and-confirmations.json.
 */

import { NextRequest } from 'next/server';
import { bookingService } from '@/lib/services/booking.service';
import { confirmationService } from '@/lib/services/confirmation.service';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ routeRunId: string }> }
) {
  try {
    const subject = await requireRole(ROLES.VET);
    const { routeRunId } = await params;

    // 1. Book the route run (atomic)
    const bookingResult = await bookingService.bookRouteRun(routeRunId);

    // 2. Send confirmations for all created appointments
    const confirmationResults = await confirmationService.sendConfirmationsForRouteRun(
      routeRunId,
      { actor: subject.actorLabel },
    );

    return successResponse({
      ...bookingResult,
      confirmations: confirmationResults,
    }, 201);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
