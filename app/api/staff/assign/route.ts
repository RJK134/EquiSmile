import { NextRequest } from 'next/server';
import { staffService } from '@/lib/services/staff.service';
import { assignAppointmentSchema, assignRouteRunSchema } from '@/lib/validations/staff.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';

/**
 * Staff assignment changes affect operational scheduling; VET+ is
 * enough (the lead vet can reassign rounds). Audit is not required for
 * every assignment — the domain RouteRun/Appointment tables already
 * carry an updatedAt marker.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole(ROLES.VET);
    const body = await request.json();

    if (body.target === 'appointment') {
      const payload = assignAppointmentSchema.parse(body);
      const result = await staffService.assignToAppointment(payload);
      return successResponse(result, 201);
    }

    if (body.target === 'routeRun') {
      const payload = assignRouteRunSchema.parse(body);
      const result = await staffService.assignToRouteRun(payload);
      return successResponse(result, 201);
    }

    return errorResponse("target must be 'appointment' or 'routeRun'", 400);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole(ROLES.VET);
    const body = await request.json();

    if (body.target === 'appointment') {
      const payload = assignAppointmentSchema.parse(body);
      await staffService.unassignFromAppointment(payload);
      return successResponse({ ok: true });
    }

    if (body.target === 'routeRun') {
      const payload = assignRouteRunSchema.parse(body);
      await staffService.unassignFromRouteRun({ ...payload, wasLead: payload.isLead });
      return successResponse({ ok: true });
    }

    return errorResponse("target must be 'appointment' or 'routeRun'", 400);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
