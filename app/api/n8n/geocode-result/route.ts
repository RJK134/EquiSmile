import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { verifyN8nApiKey } from '@/lib/utils/signature';

const geocodeResultSchema = z.object({
  yardId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  formattedAddress: z.string().optional(),
  placeId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (env.N8N_API_KEY && !verifyN8nApiKey(authHeader, env.N8N_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = geocodeResultSchema.parse(body);

    console.log('[n8n] Geocode result received', {
      yardId: payload.yardId,
      latitude: payload.latitude,
      longitude: payload.longitude,
    });

    // Placeholder: will be fully implemented in Phase 5 (route planning)
    return NextResponse.json({
      success: true,
      message: 'Geocode result acknowledged',
      data: payload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
