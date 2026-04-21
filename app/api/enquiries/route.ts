import { NextRequest } from 'next/server';
import { enquiryRepository } from '@/lib/repositories/enquiry.repository';
import { enquiryQuerySchema } from '@/lib/validations/enquiry.schema';
import { manualEnquirySchema } from '@/lib/validations/manual-enquiry.schema';
import { enquiryService } from '@/lib/services/enquiry.service';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    await requireRole(ROLES.READONLY);
    const query = enquiryQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await enquiryRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(ROLES.NURSE);
    const body = await request.json();
    const data = manualEnquirySchema.parse(body);
    const result = await enquiryService.createManualEnquiry(data);
    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
