import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { verifyN8nApiKey } from '@/lib/utils/signature';

const routeProposalSchema = z.object({
  routeRunId: z.string().uuid().optional(),
  runDate: z.string(),
  stops: z.array(
    z.object({
      yardId: z.string().uuid(),
      visitRequestId: z.string().uuid().optional(),
      sequenceNo: z.number().int().min(1),
      estimatedArrival: z.string().optional(),
      estimatedDuration: z.number().int().optional(),
    })
  ),
  totalDistanceMeters: z.number().int().optional(),
  totalTravelMinutes: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (env.N8N_API_KEY && !verifyN8nApiKey(authHeader, env.N8N_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = routeProposalSchema.parse(body);

    console.log('[n8n] Route proposal received', {
      runDate: payload.runDate,
      stopCount: payload.stops.length,
    });

    // Placeholder: will be fully implemented in Phase 5 (route planning)
    return NextResponse.json({
      success: true,
      message: 'Route proposal acknowledged',
      data: payload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
