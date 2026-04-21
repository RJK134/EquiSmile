import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { staffService } from '@/lib/services/staff.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { assignAppointmentSchema, assignRouteRunSchema } from '@/lib/validations/staff.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

/**
 * POST /api/staff/assign
 * Body: { target: 'appointment', ...assignAppointmentSchema }
 *       | { target: 'routeRun', ...assignRouteRunSchema }
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorWithRole(['admin']);
    const body = await request.json();

    if (body.target === 'appointment') {
      const payload = assignAppointmentSchema.parse(body);
      const result = await staffService.assignToAppointment(payload);
      await securityAuditService.log({
        action: 'staff.assign.appointment',
        entityType: 'appointment',
        entityId: payload.appointmentId,
        actor,
        details: { staffId: payload.staffId, primary: payload.primary ?? false },
      });
      return successResponse(result, 201);
    }

    if (body.target === 'routeRun') {
      const payload = assignRouteRunSchema.parse(body);
      const result = await staffService.assignToRouteRun(payload);
      await securityAuditService.log({
        action: 'staff.assign.route-run',
        entityType: 'route-run',
        entityId: payload.routeRunId,
        actor,
        details: { staffId: payload.staffId, isLead: payload.isLead ?? false },
      });
      return successResponse(result, 201);
    }

    return errorResponse("target must be 'appointment' or 'routeRun'", 400);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await requireActorWithRole(['admin']);
    const body = await request.json();

    if (body.target === 'appointment') {
      const payload = assignAppointmentSchema.parse(body);
      await staffService.unassignFromAppointment(payload);
      await securityAuditService.log({
        action: 'staff.unassign.appointment',
        entityType: 'appointment',
        entityId: payload.appointmentId,
        actor,
        details: { staffId: payload.staffId },
      });
      return successResponse({ ok: true });
    }

    if (body.target === 'routeRun') {
      const payload = assignRouteRunSchema.parse(body);
      await staffService.unassignFromRouteRun({ ...payload, wasLead: payload.isLead });
      await securityAuditService.log({
        action: 'staff.unassign.route-run',
        entityType: 'route-run',
        entityId: payload.routeRunId,
        actor,
        details: { staffId: payload.staffId, wasLead: payload.isLead ?? false },
      });
      return successResponse({ ok: true });
    }

    return errorResponse("target must be 'appointment' or 'routeRun'", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
