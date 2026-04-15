/**
 * Phase 9 — Google Maps integration client with demo fallback.
 *
 * Uses real Google Maps API when API key exists,
 * falls back to demo simulator otherwise.
 */

import { isDemoMode, demoLog } from '@/lib/demo/demo-mode';
import {
  simulateGeocode,
  simulateRouteOptimization,
  type RouteWaypoint,
  type SimulatedRouteResult,
} from '@/lib/demo/maps-simulator';

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

  optimizeRoute(
    origin: RouteWaypoint,
    waypoints: RouteWaypoint[],
  ): SimulatedRouteResult & { mode: 'live' | 'demo' } {
    const mode = getMode();

    if (mode === 'demo') {
      demoLog('Google Maps route optimization (demo)', {
        origin: origin.label,
        stops: waypoints.length,
      });
    }

    // Route optimization always uses the local algorithm in both modes
    // (real Google Routes Optimization API would be used in production)
    const result = simulateRouteOptimization(origin, waypoints);
    return { ...result, mode };
  },
};

// Log mode at import time (server start)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  console.log(`[GoogleMaps] Client mode: ${getMode()}`);
}
