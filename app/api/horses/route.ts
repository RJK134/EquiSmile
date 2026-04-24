import { NextRequest } from 'next/server';
import { horseRepository } from '@/lib/repositories/horse.repository';
import { createHorseSchema, horseQuerySchema } from '@/lib/validations/horse.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    const subject = await requireRole(ROLES.READONLY);
    const query = horseQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    // Tombstoned horse records carry clinical history; non-admin
    // sessions silently drop the flag (see customers/route.ts).
    if (query.includeDeleted && subject.role !== ROLES.ADMIN) {
      query.includeDeleted = false;
    }
    const result = await horseRepository.findMany(query);
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
    const data = createHorseSchema.parse(body);
    const horse = await horseRepository.create(data);
    return successResponse(horse, 201);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
