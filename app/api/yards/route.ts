import { NextRequest } from 'next/server';
import { yardRepository } from '@/lib/repositories/yard.repository';
import { createYardSchema, yardQuerySchema } from '@/lib/validations/yard.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    const subject = await requireRole(ROLES.READONLY);
    const query = yardQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    // Tombstoned yards reference customer PII via their address;
    // non-admin sessions silently drop the flag (see customers/route.ts).
    if (query.includeDeleted && subject.role !== ROLES.ADMIN) {
      query.includeDeleted = false;
    }
    const result = await yardRepository.findMany(query);
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
    const data = createYardSchema.parse(body);
    const yard = await yardRepository.create(data);
    return successResponse(yard, 201);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
