import { NextRequest } from 'next/server';
import { enquiryRepository } from '@/lib/repositories/enquiry.repository';
import { updateEnquirySchema } from '@/lib/validations/enquiry.schema';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole(ROLES.READONLY);
    const { id } = await context.params;
    const enquiry = await enquiryRepository.findById(id);
    if (!enquiry) return errorResponse('Enquiry not found', 404);
    return successResponse(enquiry);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(ROLES.NURSE);
    const { id } = await context.params;
    const body = await request.json();
    const data = updateEnquirySchema.parse(body);
    const enquiry = await enquiryRepository.update(id, data);
    return successResponse(enquiry);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
