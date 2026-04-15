import { NextResponse } from 'next/server';
import { requireDemoMode, demoLog } from '@/lib/demo/demo-mode';
import { prisma } from '@/lib/prisma';
import { simulateRouteOptimization, HOME_BASE, type RouteWaypoint } from '@/lib/demo/maps-simulator';

export const dynamic = 'force-dynamic';

export async function POST() {
  const guard = requireDemoMode();
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  // Find visit requests in PLANNING_POOL with yards that have coordinates
  const poolRequests = await prisma.visitRequest.findMany({
    where: { planningStatus: 'PLANNING_POOL' },
    include: {
      yard: true,
      customer: true,
    },
    take: 8,
  });

  if (poolRequests.length === 0) {
    return NextResponse.json({
      success: true,
      simulation: 'route-generation',
      message: 'No visit requests in planning pool.',
      route: null,
    });
  }

  const origin: RouteWaypoint = {
    lat: HOME_BASE.lat,
    lng: HOME_BASE.lng,
    label: 'Home Base (Blonay)',
  };

  const waypoints: RouteWaypoint[] = poolRequests
    .filter((vr) => vr.yard?.latitude != null && vr.yard?.longitude != null)
    .map((vr) => ({
      lat: vr.yard!.latitude!,
      lng: vr.yard!.longitude!,
      label: `${vr.yard!.yardName} (${vr.customer.fullName})`,
    }));

  if (waypoints.length === 0) {
    return NextResponse.json({
      success: true,
      simulation: 'route-generation',
      message: 'No geocoded yards in planning pool.',
      route: null,
    });
  }

  demoLog('Generating demo route', { stops: waypoints.length });

  const routeResult = simulateRouteOptimization(origin, waypoints);

  const totalVisitMinutes = poolRequests.reduce(
    (sum, vr) => sum + (vr.estimatedDurationMinutes || 45),
    0,
  );
  const totalHorses = poolRequests.reduce((sum, vr) => sum + (vr.horseCount || 1), 0);

  // Create a draft route run
  const routeRun = await prisma.routeRun.create({
    data: {
      runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      homeBaseAddress: 'Blonay, 1807, Switzerland',
      startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
      status: 'DRAFT',
      totalDistanceMeters: routeResult.totalDistanceMeters,
      totalTravelMinutes: routeResult.totalTravelMinutes,
      totalVisitMinutes,
      totalJobs: waypoints.length,
      totalHorses,
      optimizationScore: 0.85,
      notes: `[DEMO] Auto-generated route with ${waypoints.length} stops.`,
    },
  });

  return NextResponse.json({
    success: true,
    simulation: 'route-generation',
    routeRunId: routeRun.id,
    totalStops: waypoints.length,
    totalDistanceKm: Math.round(routeResult.totalDistanceMeters / 1000),
    totalTravelMinutes: routeResult.totalTravelMinutes,
    totalVisitMinutes,
    totalHorses,
    legs: routeResult.legs,
  });
}
