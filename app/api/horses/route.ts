import { NextRequest } from 'next/server';
import { horseRepository } from '@/lib/repositories/horse.repository';
import { createHorseSchema, horseQuerySchema } from '@/lib/validations/horse.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const query = horseQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await horseRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createHorseSchema.parse(body);
    const horse = await horseRepository.create(data);
    return successResponse(horse, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
