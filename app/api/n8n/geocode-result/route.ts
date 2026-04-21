import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';
import { geocodingService } from '@/lib/services/geocoding.service';

const geocodeResultSchema = z.object({
  yardId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  formattedAddress: z.string().optional(),
  placeId: z.string().optional(),
  source: z.string().optional(),
  precision: z.string().optional(),
});

const limiter = rateLimiter({ windowMs: 60_000, max: 120 });

export async function POST(request: NextRequest) {
  const rl = limiter.check(clientKeyFromRequest(request, 'n8n-geo'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const payload = geocodeResultSchema.parse(body);

    const result = await geocodingService.updateYardCoordinates(
      payload.yardId,
      payload.latitude,
      payload.longitude,
      {
        source: payload.source,
        precision: payload.precision,
        formattedAddress: payload.formattedAddress,
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
