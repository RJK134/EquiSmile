import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { verifyN8nApiKey } from '@/lib/utils/signature';
import { routeRunRepository } from '@/lib/repositories/route-run.repository';
import { enforceRequestRateLimit } from '@/lib/security/rate-limit';

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
  enforceRequestRateLimit(request, 'n8n-route-proposal', 30, 60_000);
  const authHeader = request.headers.get('authorization');
  if (!env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
  if (!verifyN8nApiKey(authHeader, env.N8N_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = routeProposalSchema.parse(body);

    // Create RouteRun record
    const routeRun = await routeRunRepository.create({
      runDate: new Date(payload.runDate),
      homeBaseAddress: env.HOME_BASE_ADDRESS || 'Home Base',
      status: 'DRAFT',
      totalDistanceMeters: payload.totalDistanceMeters,
      totalTravelMinutes: payload.totalTravelMinutes,
      totalJobs: payload.stops.length,
    });

    // Create RouteRunStop records
    const stopData = payload.stops.map((stop) => ({
      routeRunId: routeRun.id,
      sequenceNo: stop.sequenceNo,
      yardId: stop.yardId,
      visitRequestId: stop.visitRequestId,
      plannedArrival: stop.estimatedArrival ? new Date(stop.estimatedArrival) : undefined,
      serviceMinutes: stop.estimatedDuration,
    }));

    await routeRunRepository.createStops(stopData);

    return NextResponse.json({
      success: true,
      message: 'Route proposal stored',
      data: { routeRunId: routeRun.id },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
