import { NextRequest } from 'next/server';
import { enquiryRepository } from '@/lib/repositories/enquiry.repository';
import { enquiryQuerySchema } from '@/lib/validations/enquiry.schema';
import { manualEnquirySchema } from '@/lib/validations/manual-enquiry.schema';
import { enquiryService } from '@/lib/services/enquiry.service';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const query = enquiryQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await enquiryRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = manualEnquirySchema.parse(body);
    const result = await enquiryService.createManualEnquiry(data);
    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
