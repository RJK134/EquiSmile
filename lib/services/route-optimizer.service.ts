/**
 * Phase 5 — Google Route Optimization API Integration
 *
 * Builds optimizeTours requests, calls the API, and parses responses.
 * Endpoint: POST https://routeoptimization.googleapis.com/v1/projects/{project_id}:optimizeTours
 */

import { env } from '@/lib/env';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OptimizationStop {
  visitRequestId: string;
  yardId: string;
  latitude: number;
  longitude: number;
  serviceDurationSeconds: number;
  timeWindowStart: string; // ISO 8601
  timeWindowEnd: string;
  label: string;
}

export interface OptimizationVehicle {
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  startTime: string;
  endTime: string;
}

export interface OptimizationRequest {
  model: {
    shipments: Array<{
      pickups: Array<{
        arrivalLocation: { latitude: number; longitude: number };
        duration: string;
        timeWindows: Array<{
          startTime: string;
          endTime: string;
        }>;
      }>;
      label: string;
    }>;
    vehicles: Array<{
      startLocation: { latitude: number; longitude: number };
      endLocation: { latitude: number; longitude: number };
      startTimeWindows: Array<{ startTime: string; endTime: string }>;
      endTimeWindows: Array<{ startTime: string; endTime: string }>;
      travelMode: string;
      costPerKilometer: number;
      costPerHour: number;
    }>;
  };
  searchMode: string;
}

export interface OptimizedVisit {
  visitRequestId: string;
  label: string;
  sequence: number;
  arrivalTime: string;
  departureTime: string;
  travelDurationSeconds: number;
  travelDistanceMeters: number;
}

export interface OptimizationResult {
  visits: OptimizedVisit[];
  skippedVisitRequestIds: string[];
  totalDistanceMeters: number;
  totalTravelSeconds: number;
  rawResponse?: unknown;
}

interface RouteOptApiResponse {
  routes?: Array<{
    visits?: Array<{
      shipmentIndex: number;
      startTime?: string;
      detour?: string;
    }>;
    transitions?: Array<{
      travelDuration?: string;
      travelDistanceMeters?: number;
      startTime?: string;
    }>;
    vehicleStartTime?: string;
    vehicleEndTime?: string;
  }>;
  skippedShipments?: Array<{
    index: number;
    label?: string;
  }>;
  totalCost?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const routeOptimizerService = {
  /**
   * Build the optimizeTours request payload.
   */
  buildRequest(stops: OptimizationStop[], vehicle: OptimizationVehicle): OptimizationRequest {
    return {
      model: {
        shipments: stops.map((stop) => ({
          pickups: [
            {
              arrivalLocation: {
                latitude: stop.latitude,
                longitude: stop.longitude,
              },
              duration: `${stop.serviceDurationSeconds}s`,
              timeWindows: [
                {
                  startTime: stop.timeWindowStart,
                  endTime: stop.timeWindowEnd,
                },
              ],
            },
          ],
          label: stop.visitRequestId,
        })),
        vehicles: [
          {
            startLocation: {
              latitude: vehicle.startLatitude,
              longitude: vehicle.startLongitude,
            },
            endLocation: {
              latitude: vehicle.endLatitude,
              longitude: vehicle.endLongitude,
            },
            startTimeWindows: [
              { startTime: vehicle.startTime, endTime: vehicle.startTime },
            ],
            endTimeWindows: [
              { startTime: vehicle.endTime, endTime: vehicle.endTime },
            ],
            travelMode: 'DRIVING',
            costPerKilometer: 0.5,
            costPerHour: 1.0,
          },
        ],
      },
      searchMode: 'RETURN_FAST',
    };
  },

  /**
   * Parse the optimizeTours API response into structured results.
   */
  parseResponse(
    response: RouteOptApiResponse,
    stops: OptimizationStop[],
  ): OptimizationResult {
    const visits: OptimizedVisit[] = [];
    let totalDistanceMeters = 0;
    let totalTravelSeconds = 0;

    const route = response.routes?.[0];
    if (route?.visits) {
      for (let i = 0; i < route.visits.length; i++) {
        const visit = route.visits[i];
        const stop = stops[visit.shipmentIndex];
        if (!stop) continue;

        const transition = route.transitions?.[i + 1]; // transitions[0] is start → first stop
        const travelDurationSeconds = parseDuration(transition?.travelDuration);
        const travelDistanceMeters = transition?.travelDistanceMeters ?? 0;

        totalDistanceMeters += travelDistanceMeters;
        totalTravelSeconds += travelDurationSeconds;

        const arrivalTime = visit.startTime || '';
        const serviceEnd = arrivalTime
          ? addSeconds(arrivalTime, stop.serviceDurationSeconds)
          : '';

        visits.push({
          visitRequestId: stop.visitRequestId,
          label: stop.label,
          sequence: i + 1,
          arrivalTime,
          departureTime: serviceEnd,
          travelDurationSeconds,
          travelDistanceMeters,
        });
      }
    }

    // Skipped shipments
    const skippedVisitRequestIds: string[] = [];
    if (response.skippedShipments) {
      for (const skipped of response.skippedShipments) {
        const stop = stops[skipped.index];
        if (stop) {
          skippedVisitRequestIds.push(stop.visitRequestId);
        }
      }
    }

    return {
      visits,
      skippedVisitRequestIds,
      totalDistanceMeters,
      totalTravelSeconds,
      rawResponse: response,
    };
  },

  /**
   * Call the Google Route Optimization API.
   */
  async optimizeRoute(
    stops: OptimizationStop[],
    vehicle: OptimizationVehicle,
  ): Promise<OptimizationResult> {
    const projectId = env.GCP_PROJECT_ID;
    if (!projectId) {
      throw new Error('GCP_PROJECT_ID is not configured');
    }

    const request = routeOptimizerService.buildRequest(stops, vehicle);
    const url = `https://routeoptimization.googleapis.com/v1/projects/${projectId}:optimizeTours`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Auth: prefer API key, fallback to service account
    if (env.GOOGLE_MAPS_API_KEY) {
      const urlWithKey = `${url}?key=${env.GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(urlWithKey, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Route Optimization API error (${response.status}): ${error}`);
      }

      const data = (await response.json()) as RouteOptApiResponse;
      return routeOptimizerService.parseResponse(data, stops);
    }

    throw new Error(
      'No authentication configured for Route Optimization API. Set GOOGLE_MAPS_API_KEY or GOOGLE_APPLICATION_CREDENTIALS.',
    );
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a Google API duration string (e.g. "300s") to seconds.
 */
function parseDuration(duration?: string): number {
  if (!duration) return 0;
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}

/**
 * Add seconds to an ISO 8601 timestamp.
 */
function addSeconds(isoString: string, seconds: number): string {
  const date = new Date(isoString);
  date.setSeconds(date.getSeconds() + seconds);
  return date.toISOString();
}
