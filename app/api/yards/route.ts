import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { yardRepository } from '@/lib/repositories/yard.repository';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { createYardSchema, yardQuerySchema } from '@/lib/validations/yard.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    await requireActorWithRole(['admin', 'vet', 'nurse']);
    const query = yardQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await yardRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const body = await request.json();
    const data = createYardSchema.parse(body);
    const yard = await yardRepository.create(data);
    await securityAuditService.log({
      action: 'yard.create',
      entityType: 'yard',
      entityId: yard.id,
      actor,
      details: { postcode: yard.postcode },
    });
    return successResponse(yard, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
