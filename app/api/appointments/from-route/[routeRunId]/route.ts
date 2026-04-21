/**
 * POST /api/appointments/from-route/[routeRunId] — Convert approved route to appointments
 */

import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { bookingService } from '@/lib/services/booking.service';
import { confirmationService } from '@/lib/services/confirmation.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ routeRunId: string }> }
) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const { routeRunId } = await params;

    // 1. Book the route run (atomic)
    const bookingResult = await bookingService.bookRouteRun(routeRunId);

    // 2. Send confirmations for all created appointments
    const confirmationResults = await confirmationService.sendConfirmationsForRouteRun(routeRunId);

    await securityAuditService.log({
      action: 'appointment.book-from-route',
      entityType: 'route-run',
      entityId: routeRunId,
      actor,
      details: {
        appointmentCount: bookingResult.appointmentCount,
        confirmationsSent: confirmationResults.filter((result) => result.sent).length,
      },
    });

    return successResponse({
      ...bookingResult,
      confirmations: confirmationResults,
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
