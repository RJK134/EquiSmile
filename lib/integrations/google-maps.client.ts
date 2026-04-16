/**
 * Phase 9/10 — Google Maps integration client with demo fallback.
 *
 * Uses real Google Maps API when API key exists,
 * falls back to demo simulator otherwise.
 *
 * Phase 10: Added real optimizeTours API call via routeOptimizerService
 * when DEMO_MODE=false and credentials are set. Falls back to local
 * nearest-neighbor algorithm on API failure or in demo mode.
 */

import { isDemoMode, demoLog } from '@/lib/demo/demo-mode';
import {
  simulateGeocode,
  simulateRouteOptimization,
  type RouteWaypoint,
  type SimulatedRouteResult,
} from '@/lib/demo/maps-simulator';
import { routeOptimizerService, type OptimizationStop, type OptimizationVehicle, type OptimizationResult } from '@/lib/services/route-optimizer.service';

const GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string;
  partialMatch: boolean;
  mode: 'live' | 'demo';
}

function hasCredentials(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY;
}

function hasOptimizationCredentials(): boolean {
  return !!process.env.GOOGLE_MAPS_API_KEY && !!process.env.GCP_PROJECT_ID;
}

function getMode(): 'live' | 'demo' {
  if (isDemoMode()) return 'demo';
  if (!hasCredentials()) return 'demo';
  return 'live';
}

export const googleMapsClient = {
  getMode,

  async geocode(address: string): Promise<GeocodeResult | null> {
    const mode = getMode();

    if (mode === 'demo') {
      demoLog('Google Maps geocode (demo)', { address });
      const result = simulateGeocode(address);
      if (!result) return null;
      return { ...result, mode: 'demo' };
    }

    const url = new URL(GEOCODING_API_URL);
    url.searchParams.set('address', address);
    url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!);
    url.searchParams.set('region', 'ch');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'ZERO_RESULTS') return null;
    if (data.status !== 'OK') {
      throw new Error(`Geocoding API error: ${data.status}`);
    }

    const result = data.results[0];
    if (!result) return null;

    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      partialMatch: result.partial_match ?? false,
      mode: 'live',
    };
  },

  /**
   * Optimize a route using Google Route Optimization API (optimizeTours).
   *
   * When DEMO_MODE=false AND both GOOGLE_MAPS_API_KEY + GCP_PROJECT_ID are set,
   * calls the real API. Falls back to local nearest-neighbor on API failure or
   * when in demo mode.
   */
  async optimizeRoute(
    origin: RouteWaypoint,
    waypoints: RouteWaypoint[],
  ): Promise<SimulatedRouteResult & { mode: 'live' | 'demo' }> {
    const mode = getMode();

    // Use real API when not in demo mode and credentials are available
    if (mode === 'live' && hasOptimizationCredentials()) {
      try {
        const now = new Date();
        const dayEnd = new Date(now.getTime() + 9 * 3600_000);

        const stops: OptimizationStop[] = waypoints.map((wp) => ({
          visitRequestId: wp.label || `stop-${wp.lat}-${wp.lng}`,
          yardId: wp.label || '',
          latitude: wp.lat,
          longitude: wp.lng,
          serviceDurationSeconds: 45 * 60, // default 45 min per stop
          timeWindowStart: now.toISOString(),
          timeWindowEnd: dayEnd.toISOString(),
          label: wp.label || '',
        }));

        const vehicle: OptimizationVehicle = {
          startLatitude: origin.lat,
          startLongitude: origin.lng,
          endLatitude: origin.lat,
          endLongitude: origin.lng,
          startTime: now.toISOString(),
          endTime: dayEnd.toISOString(),
        };

        const apiResult: OptimizationResult = await routeOptimizerService.optimizeRoute(stops, vehicle);

        // Convert API result to SimulatedRouteResult format
        const optimizedWaypoints: RouteWaypoint[] = apiResult.visits.map((v) => {
          const original = waypoints.find((wp) => wp.label === v.visitRequestId) || waypoints[v.sequence - 1];
          return original || waypoints[0];
        });

        return {
          orderedWaypoints: optimizedWaypoints,
          totalDistanceMeters: apiResult.totalDistanceMeters,
          totalTravelMinutes: Math.round(apiResult.totalTravelSeconds / 60),
          legs: apiResult.visits.map((v, i) => ({
            from: i === 0 ? origin.label : (optimizedWaypoints[i - 1]?.label || ''),
            to: optimizedWaypoints[i]?.label || v.label,
            distanceMeters: v.travelDistanceMeters,
            durationMinutes: Math.max(Math.round(v.travelDurationSeconds / 60), 1),
          })),
          mode: 'live',
        };
      } catch (error) {
        console.warn(
          '[GoogleMaps] Route Optimization API failed, falling back to local algorithm:',
          error instanceof Error ? error.message : error,
        );
        // Fall through to local algorithm
      }
    }

    if (mode === 'demo') {
      demoLog('Google Maps route optimization (demo)', {
        origin: origin.label,
        stops: waypoints.length,
      });
    }

    // Fallback: local nearest-neighbor algorithm
    const result = simulateRouteOptimization(origin, waypoints);
    return { ...result, mode };
  },
};

// Log mode at import time (server start)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  console.log(`[GoogleMaps] Client mode: ${getMode()}`);
}
