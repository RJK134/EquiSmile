import { NextRequest } from 'next/server';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { geocodingService } from '@/lib/services/geocoding.service';
import { z } from 'zod';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';
import { rateLimiter, rateLimitedResponse } from '@/lib/utils/rate-limit';

const geocodeSchema = z.object({
  yardId: z.string().uuid().optional(),
  batch: z.boolean().optional(),
});

// Cap per-user to 30/hour — batch-geocode can burn a lot of paid
// Google Maps quota and slow the DB.
const limiter = rateLimiter({ windowMs: 60 * 60 * 1000, max: 30 });

export async function POST(request: NextRequest) {
  let subject: Awaited<ReturnType<typeof requireRole>>;
  try {
    subject = await requireRole(ROLES.VET);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }

  const decision = limiter.check(`geocode:${subject.id}`);
  if (!decision.allowed) return rateLimitedResponse(decision);

  try {
    const body = await request.json().catch(() => ({}));
    const { yardId, batch } = geocodeSchema.parse(body);

    if (batch) {
      const result = await geocodingService.batchGeocodeYards();
      return successResponse({
        success: true,
        message: `Batch geocoding complete: ${result.succeeded}/${result.total} succeeded`,
        ...result,
      });
    }

    if (yardId) {
      const result = await geocodingService.geocodeYard(yardId);
      if (!result.success) {
        return errorResponse(result.error || 'Geocoding failed', 400);
      }
      return successResponse({ success: true, message: 'Yard geocoded successfully' });
    }

    return errorResponse('Provide yardId or set batch: true', 400);
  } catch (error) {
    return handleApiError(error);
  }
}
