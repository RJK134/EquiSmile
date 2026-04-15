import { NextRequest } from 'next/server';
import { customerRepository } from '@/lib/repositories/customer.repository';
import { createCustomerSchema, customerQuerySchema } from '@/lib/validations/customer.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const query = customerQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await customerRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createCustomerSchema.parse(body);
    const customer = await customerRepository.create(data);
    return successResponse(customer, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
