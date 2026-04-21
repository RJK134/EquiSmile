import { NextRequest } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { horseRepository } from '@/lib/repositories/horse.repository';
import { securityAuditService } from '@/lib/services/security-audit.service';
import { createHorseSchema, horseQuerySchema } from '@/lib/validations/horse.schema';
import { successResponse, handleApiError, parseSearchParams } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    await requireActorWithRole(['admin', 'vet', 'nurse']);
    const query = horseQuerySchema.parse(parseSearchParams(request.nextUrl.searchParams));
    const result = await horseRepository.findMany(query);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActorWithRole(['admin', 'vet']);
    const body = await request.json();
    const data = createHorseSchema.parse(body);
    const horse = await horseRepository.create(data);
    await securityAuditService.log({
      action: 'horse.create',
      entityType: 'horse',
      entityId: horse.id,
      actor,
      details: { customerId: horse.customerId },
    });
    return successResponse(horse, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
