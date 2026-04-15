/**
 * Phase 5 — Route Proposal Generation Pipeline
 *
 * Full planning pipeline:
 * 1. Fetch eligible visit requests
 * 2. Verify geocoding
 * 3. Cluster by geography
 * 4. Optimize routes via Google API
 * 5. Score routes
 * 6. Create RouteRun + RouteRunStop records
 */

import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { geocodingService } from './geocoding.service';
import { clusteringService, type ClusterableVisit, type Cluster } from './clustering.service';
import { scoreRoute } from './route-scoring.service';
import { routeOptimizerService, type OptimizationStop, type OptimizationResult } from './route-optimizer.service';
import { routeRunRepository } from '@/lib/repositories/route-run.repository';

// ---------------------------------------------------------------------------
// Planning constraints
// ---------------------------------------------------------------------------

const PLANNING_CONSTRAINTS = {
  workdayStartHour: 8,
  workdayStartMinute: 30,
  workdayEndHour: 17,
  workdayEndMinute: 30,
  maxTravelMinutesPerDay: 180,
  maxStopsPerDay: 6,
  maxHorsesPerDay: 10,
  standardServiceMinutesPerHorse: 30,
  bufferMinutesPerStop: 15,
  preferredMaxInterStopMinutes: 25,
  minDensityScoreThreshold: 20,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteProposal {
  routeRunId: string;
  runDate: string;
  status: string;
  stops: Array<{
    sequenceNo: number;
    yardId: string;
    yardName: string;
    visitRequestId: string | null;
    customerName: string;
    horseCount: number;
    plannedArrival: string | null;
    plannedDeparture: string | null;
    travelFromPrevMinutes: number | null;
    serviceMinutes: number;
  }>;
  skippedVisitRequestIds: string[];
  totalDistanceMeters: number;
  totalTravelMinutes: number;
  totalVisitMinutes: number;
  totalJobs: number;
  totalHorses: number;
  optimizationScore: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const routeProposalService = {
  /**
   * Generate route proposals from the planning pool.
   */
  async generateProposals(targetDate?: string): Promise<RouteProposal[]> {
    // 1. Fetch eligible visit requests
    const visitRequests = await prisma.visitRequest.findMany({
      where: {
        planningStatus: { in: ['PLANNING_POOL', 'READY_FOR_REVIEW'] },
        urgencyLevel: { not: 'URGENT' },
      },
      include: {
        customer: { select: { id: true, fullName: true } },
        yard: true,
      },
    });

    if (visitRequests.length === 0) {
      return [];
    }

    // 2. Verify all yards are geocoded
    const yardsToGeocode = visitRequests
      .filter((vr) => vr.yard && (vr.yard.latitude === null || vr.yard.longitude === null))
      .map((vr) => vr.yard!.id);

    const uniqueYardIds = [...new Set(yardsToGeocode)];
    for (const yardId of uniqueYardIds) {
      await geocodingService.geocodeYard(yardId);
    }

    // Re-fetch after geocoding to get updated coordinates
    const updatedVisitRequests = await prisma.visitRequest.findMany({
      where: {
        id: { in: visitRequests.map((vr) => vr.id) },
      },
      include: {
        customer: { select: { id: true, fullName: true } },
        yard: true,
      },
    });

    // 3. Filter to only those with valid geocoded yards
    const geocodedVisits: ClusterableVisit[] = [];
    for (const vr of updatedVisitRequests) {
      if (!vr.yard || vr.yard.latitude === null || vr.yard.longitude === null) {
        continue;
      }

      geocodedVisits.push({
        visitRequestId: vr.id,
        yardId: vr.yard.id,
        latitude: vr.yard.latitude,
        longitude: vr.yard.longitude,
        postcode: vr.yard.postcode,
        horseCount: vr.horseCount ?? 1,
        estimatedDurationMinutes:
          vr.estimatedDurationMinutes ??
          (vr.horseCount ?? 1) * PLANNING_CONSTRAINTS.standardServiceMinutesPerHorse +
            PLANNING_CONSTRAINTS.bufferMinutesPerStop,
        urgencyLevel: vr.urgencyLevel as 'URGENT' | 'SOON' | 'ROUTINE',
        preferredDays: vr.preferredDays,
        preferredTimeBand: vr.preferredTimeBand,
        revenueEstimate: vr.revenueEstimate,
        areaLabel: vr.yard.areaLabel,
      });
    }

    if (geocodedVisits.length === 0) {
      return [];
    }

    // 4. Run clustering
    const clusters = clusteringService.clusterVisits(geocodedVisits);

    // 5. For each viable cluster, generate a route proposal
    const proposals: RouteProposal[] = [];
    const runDate = targetDate || new Date().toISOString().split('T')[0];

    for (const cluster of clusters) {
      // Check planning constraints
      if (cluster.visits.length > PLANNING_CONSTRAINTS.maxStopsPerDay) {
        // Split large clusters - take top N by priority
        cluster.visits.splice(PLANNING_CONSTRAINTS.maxStopsPerDay);
        cluster.visitRequestIds.splice(PLANNING_CONSTRAINTS.maxStopsPerDay);
      }

      if (cluster.totalHorseCount > PLANNING_CONSTRAINTS.maxHorsesPerDay) {
        // Skip if we can't trim — move on to prioritize feasible clusters
        if (cluster.visits.length <= 2) continue;
      }

      // Check density threshold (allow high clinical priority to bypass)
      const hasHighPriority = cluster.visits.some((v) => v.urgencyLevel === 'SOON');
      if (
        cluster.densityScore < PLANNING_CONSTRAINTS.minDensityScoreThreshold &&
        !hasHighPriority
      ) {
        continue;
      }

      const proposal = await buildRouteProposal(cluster, runDate);
      if (proposal) {
        proposals.push(proposal);
      }
    }

    return proposals;
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function buildRouteProposal(
  cluster: Cluster,
  runDate: string,
): Promise<RouteProposal | null> {
  const homeBaseLat = parseFloat(env.HOME_BASE_LAT) || 51.5074;
  const homeBaseLng = parseFloat(env.HOME_BASE_LNG) || -0.1278;
  const homeBaseAddress = env.HOME_BASE_ADDRESS || 'Home Base';

  // Build time windows
  const dayStart = `${runDate}T${pad(PLANNING_CONSTRAINTS.workdayStartHour)}:${pad(PLANNING_CONSTRAINTS.workdayStartMinute)}:00Z`;
  const dayEnd = `${runDate}T${pad(PLANNING_CONSTRAINTS.workdayEndHour)}:${pad(PLANNING_CONSTRAINTS.workdayEndMinute)}:00Z`;

  const optimizationStops: OptimizationStop[] = cluster.visits.map((v) => {
    const serviceDuration =
      v.horseCount * PLANNING_CONSTRAINTS.standardServiceMinutesPerHorse +
      PLANNING_CONSTRAINTS.bufferMinutesPerStop;

    let timeWindowStart = dayStart;
    let timeWindowEnd = dayEnd;
    if (v.preferredTimeBand === 'AM') {
      timeWindowEnd = `${runDate}T12:00:00Z`;
    } else if (v.preferredTimeBand === 'PM') {
      timeWindowStart = `${runDate}T12:00:00Z`;
    }

    return {
      visitRequestId: v.visitRequestId,
      yardId: v.yardId,
      latitude: v.latitude,
      longitude: v.longitude,
      serviceDurationSeconds: serviceDuration * 60,
      timeWindowStart,
      timeWindowEnd,
      label: v.visitRequestId,
    };
  });

  let optimizationResult: OptimizationResult | null = null;

  // Try Google Route Optimization if configured
  if (env.GCP_PROJECT_ID && env.GOOGLE_MAPS_API_KEY) {
    try {
      optimizationResult = await routeOptimizerService.optimizeRoute(
        optimizationStops,
        {
          startLatitude: homeBaseLat,
          startLongitude: homeBaseLng,
          endLatitude: homeBaseLat,
          endLongitude: homeBaseLng,
          startTime: dayStart,
          endTime: dayEnd,
        },
      );
    } catch (error) {
      console.warn(
        '[route-proposal] Route Optimization API failed, using cluster order:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Build stop records
  const stopRecords: Array<{
    sequenceNo: number;
    yardId: string;
    yardName: string;
    visitRequestId: string;
    customerName: string;
    horseCount: number;
    plannedArrival: string | null;
    plannedDeparture: string | null;
    travelFromPrevMinutes: number | null;
    serviceMinutes: number;
  }> = [];

  let totalTravelMinutes = 0;
  let totalVisitMinutes = 0;
  let totalDistanceMeters = 0;
  const skippedVisitRequestIds: string[] = [];

  if (optimizationResult && optimizationResult.visits.length > 0) {
    // Use optimized order
    for (const visit of optimizationResult.visits) {
      const clusterVisit = cluster.visits.find((v) => v.visitRequestId === visit.visitRequestId);
      if (!clusterVisit) continue;

      const serviceMinutes =
        clusterVisit.horseCount * PLANNING_CONSTRAINTS.standardServiceMinutesPerHorse +
        PLANNING_CONSTRAINTS.bufferMinutesPerStop;
      const travelMinutes = Math.round(visit.travelDurationSeconds / 60);

      totalTravelMinutes += travelMinutes;
      totalVisitMinutes += serviceMinutes;

      stopRecords.push({
        sequenceNo: visit.sequence,
        yardId: clusterVisit.yardId,
        yardName: '', // Will be filled from DB
        visitRequestId: clusterVisit.visitRequestId,
        customerName: '',
        horseCount: clusterVisit.horseCount,
        plannedArrival: visit.arrivalTime || null,
        plannedDeparture: visit.departureTime || null,
        travelFromPrevMinutes: travelMinutes,
        serviceMinutes,
      });
    }

    totalDistanceMeters = optimizationResult.totalDistanceMeters;
    skippedVisitRequestIds.push(...optimizationResult.skippedVisitRequestIds);
  } else {
    // Fallback: use cluster order
    for (let i = 0; i < cluster.visits.length; i++) {
      const visit = cluster.visits[i];
      const serviceMinutes =
        visit.horseCount * PLANNING_CONSTRAINTS.standardServiceMinutesPerHorse +
        PLANNING_CONSTRAINTS.bufferMinutesPerStop;

      totalVisitMinutes += serviceMinutes;

      stopRecords.push({
        sequenceNo: i + 1,
        yardId: visit.yardId,
        yardName: '',
        visitRequestId: visit.visitRequestId,
        customerName: '',
        horseCount: visit.horseCount,
        plannedArrival: null,
        plannedDeparture: null,
        travelFromPrevMinutes: null,
        serviceMinutes,
      });
    }
  }

  // Check max travel constraint
  if (totalTravelMinutes > PLANNING_CONSTRAINTS.maxTravelMinutesPerDay) {
    return null;
  }

  // Score the route
  const totalHorses = cluster.visits.reduce((sum, v) => sum + v.horseCount, 0);
  const scoreResult = scoreRoute({
    horseCount: totalHorses,
    jobs: stopRecords.length,
    travelMinutes: totalTravelMinutes,
    gaps: 0,
    stops: cluster.visits.map((v) => ({
      horseCount: v.horseCount,
      urgencyLevel: v.urgencyLevel,
      preferredDays: v.preferredDays,
      serviceMinutes:
        v.horseCount * PLANNING_CONSTRAINTS.standardServiceMinutesPerHorse +
        PLANNING_CONSTRAINTS.bufferMinutesPerStop,
    })),
    totalWorkMinutes: totalTravelMinutes + totalVisitMinutes,
  });

  // 6. Create RouteRun record
  const routeRun = await routeRunRepository.create({
    runDate: new Date(runDate),
    homeBaseAddress: homeBaseAddress,
    startTime: new Date(dayStart),
    endTime: new Date(dayEnd),
    status: 'DRAFT',
    totalDistanceMeters,
    totalTravelMinutes,
    totalVisitMinutes,
    totalJobs: stopRecords.length,
    totalHorses,
    optimizationScore: scoreResult.score,
  });

  // Create RouteRunStop records
  const stopData = stopRecords.map((stop) => ({
    routeRunId: routeRun.id,
    sequenceNo: stop.sequenceNo,
    visitRequestId: stop.visitRequestId,
    yardId: stop.yardId,
    plannedArrival: stop.plannedArrival ? new Date(stop.plannedArrival) : undefined,
    plannedDeparture: stop.plannedDeparture ? new Date(stop.plannedDeparture) : undefined,
    serviceMinutes: stop.serviceMinutes,
    travelFromPrevMinutes: stop.travelFromPrevMinutes ?? undefined,
    travelFromPrevMeters: undefined,
    optimizationScore: scoreResult.score,
  }));

  await routeRunRepository.createStops(stopData);

  // Update visit request planning statuses
  const visitRequestIds = stopRecords.map((s) => s.visitRequestId);
  await prisma.visitRequest.updateMany({
    where: { id: { in: visitRequestIds } },
    data: { planningStatus: 'CLUSTERED' },
  });

  // Fetch full yard/customer info for the response
  const fullRouteRun = await routeRunRepository.findById(routeRun.id);
  const enrichedStops = stopRecords.map((stop) => {
    const fullStop = fullRouteRun?.stops.find((s) => s.yardId === stop.yardId);
    return {
      ...stop,
      yardName: fullStop?.yard?.yardName || '',
      customerName: fullStop?.visitRequest?.customer?.fullName || '',
    };
  });

  return {
    routeRunId: routeRun.id,
    runDate,
    status: 'DRAFT',
    stops: enrichedStops,
    skippedVisitRequestIds,
    totalDistanceMeters,
    totalTravelMinutes,
    totalVisitMinutes,
    totalJobs: stopRecords.length,
    totalHorses,
    optimizationScore: scoreResult.score,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
