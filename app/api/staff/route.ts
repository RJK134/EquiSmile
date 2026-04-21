import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { staffService } from '@/lib/services/staff.service';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { createStaffSchema } from '@/lib/validations/staff.schema';
import { successResponse, errorResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    await requireActorWithRole(['admin']);
    const params = parseSearchParams(request.nextUrl.searchParams);
    const active = params.active === 'true' ? true : params.active === 'false' ? false : undefined;
    const role = params.role as 'VET' | 'ADMIN' | 'NURSE' | undefined;
    const staff = await staffService.list({ active, role });
    return successResponse(staff);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorWithRole(['admin']);
    const body = await request.json();
    const payload = createStaffSchema.parse(body);
    const created = await staffService.create(payload);
    await securityAuditService.log({
      action: 'staff.create',
      entityType: 'staff',
      entityId: created.id,
      actor,
      details: { role: created.role },
    });
    return successResponse(created, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return errorResponse(error.message, 409);
    }
    return handleApiError(error);
  }
}
