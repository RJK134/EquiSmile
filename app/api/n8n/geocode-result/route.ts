import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { verifyN8nApiKey } from '@/lib/utils/signature';
import { geocodingService } from '@/lib/services/geocoding.service';
import { enforceRequestRateLimit } from '@/lib/security/rate-limit';

const geocodeResultSchema = z.object({
  yardId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  formattedAddress: z.string().optional(),
  placeId: z.string().optional(),
  precision: z.string().optional(),
  source: z.string().optional(),
});

export async function POST(request: NextRequest) {
  enforceRequestRateLimit(request, 'n8n-geocode-result', 60, 60_000);
  const authHeader = request.headers.get('authorization');
  if (!env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
  if (!verifyN8nApiKey(authHeader, env.N8N_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = geocodeResultSchema.parse(body);

    const result = await geocodingService.updateYardCoordinates(
      payload.yardId,
      payload.latitude,
      payload.longitude,
      {
        formattedAddress: payload.formattedAddress,
        placeId: payload.placeId,
        precision: payload.precision,
        source: payload.source ?? 'n8n',
      },
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Geocode result stored',
      data: payload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
