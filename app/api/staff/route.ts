import { NextRequest } from 'next/server';
import { staffService } from '@/lib/services/staff.service';
import { createStaffSchema } from '@/lib/validations/staff.schema';
import { successResponse, errorResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';

export async function GET(request: NextRequest) {
  try {
    await requireRole(ROLES.READONLY);
    const params = parseSearchParams(request.nextUrl.searchParams);
    const active = params.active === 'true' ? true : params.active === 'false' ? false : undefined;
    const role = params.role as 'VET' | 'ADMIN' | 'NURSE' | undefined;
    const staff = await staffService.list({ active, role });
    return successResponse(staff);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const subject = await requireRole(ROLES.ADMIN);
    const body = await request.json();
    const payload = createStaffSchema.parse(body);
    const created = await staffService.create(payload);
    await securityAuditService.record({
      event: 'STAFF_CREATED',
      actor: subject,
      targetType: 'Staff',
      targetId: created.id,
      detail: `role=${created.role}; email=${created.email ?? 'n/a'}`,
    });
    return successResponse(created, 201);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return errorResponse(error.message, 409);
    }
    return handleApiError(error);
  }
}
