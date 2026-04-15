import { NextRequest } from 'next/server';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { geocodingService } from '@/lib/services/geocoding.service';
import { z } from 'zod';

const geocodeSchema = z.object({
  yardId: z.string().uuid().optional(),
  batch: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
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
