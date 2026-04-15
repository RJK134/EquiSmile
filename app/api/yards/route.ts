import { NextRequest } from 'next/server';
import { yardRepository } from '@/lib/repositories/yard.repository';
import { createYardSchema, yardQuerySchema } from '@/lib/validations/yard.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const query = yardQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await yardRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createYardSchema.parse(body);
    const yard = await yardRepository.create(data);
    return successResponse(yard, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
