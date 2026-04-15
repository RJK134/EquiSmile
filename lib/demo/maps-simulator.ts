/**
 * Phase 9 — Google Maps simulator for demo mode.
 *
 * Returns realistic geocoding and route optimization responses
 * using actual Swiss coordinates for the Vaud/Fribourg demo area.
 */

import { demoLog } from './demo-mode';

// ---------------------------------------------------------------------------
// Demo yard locations (real Swiss coordinates)
// ---------------------------------------------------------------------------

export const DEMO_LOCATIONS: Record<string, {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
}> = {
  'Villeneuve VD': {
    lat: 46.3970,
    lng: 6.9277,
    formattedAddress: 'Villeneuve, 1844 Villeneuve, Switzerland',
    placeId: 'ChIJ_demo_villeneuve',
  },
  'Montreux': {
    lat: 46.4312,
    lng: 6.9107,
    formattedAddress: 'Montreux, 1820 Montreux, Switzerland',
    placeId: 'ChIJ_demo_montreux',
  },
  'Aigle': {
    lat: 46.3180,
    lng: 6.9706,
    formattedAddress: 'Aigle, 1860 Aigle, Switzerland',
    placeId: 'ChIJ_demo_aigle',
  },
  'Château-d\'Oex': {
    lat: 46.4747,
    lng: 7.1366,
    formattedAddress: 'Château-d\'Oex, 1660 Château-d\'Oex, Switzerland',
    placeId: 'ChIJ_demo_chateau_doex',
  },
  'Bulle': {
    lat: 46.6193,
    lng: 7.0570,
    formattedAddress: 'Bulle, 1630 Bulle, Switzerland',
    placeId: 'ChIJ_demo_bulle',
  },
  'Avenches': {
    lat: 46.8820,
    lng: 7.0422,
    formattedAddress: 'Avenches, 1580 Avenches, Switzerland',
    placeId: 'ChIJ_demo_avenches',
  },
  'Lausanne': {
    lat: 46.5197,
    lng: 6.6323,
    formattedAddress: 'Lausanne, 1000 Lausanne, Switzerland',
    placeId: 'ChIJ_demo_lausanne',
  },
  'Nyon': {
    lat: 46.3833,
    lng: 6.2398,
    formattedAddress: 'Nyon, 1260 Nyon, Switzerland',
    placeId: 'ChIJ_demo_nyon',
  },
  'Blonay': {
    lat: 46.4653,
    lng: 6.8961,
    formattedAddress: 'Blonay, 1807 Blonay, Switzerland',
    placeId: 'ChIJ_demo_blonay',
  },
};

// Home base for route planning
export const HOME_BASE = DEMO_LOCATIONS['Blonay'];

// ---------------------------------------------------------------------------
// Geocoding simulation
// ---------------------------------------------------------------------------

export interface SimulatedGeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string;
  partialMatch: boolean;
}

export function simulateGeocode(address: string): SimulatedGeocodeResult | null {
  demoLog('Simulating geocode', { address });

  // Try to match against known locations
  for (const [name, loc] of Object.entries(DEMO_LOCATIONS)) {
    if (address.toLowerCase().includes(name.toLowerCase())) {
      return {
        latitude: loc.lat,
        longitude: loc.lng,
        formattedAddress: loc.formattedAddress,
        placeId: loc.placeId,
        partialMatch: false,
      };
    }
  }

  // Fallback: return a location near Montreux with slight randomisation
  const base = DEMO_LOCATIONS['Montreux'];
  return {
    latitude: base.lat + (Math.random() - 0.5) * 0.05,
    longitude: base.lng + (Math.random() - 0.5) * 0.05,
    formattedAddress: `${address}, Switzerland`,
    placeId: `ChIJ_demo_fallback_${Date.now()}`,
    partialMatch: true,
  };
}

// ---------------------------------------------------------------------------
// Route optimization simulation
// ---------------------------------------------------------------------------

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface RouteWaypoint {
  lat: number;
  lng: number;
  label: string;
}

export interface SimulatedRouteResult {
  totalDistanceMeters: number;
  totalTravelMinutes: number;
  orderedWaypoints: RouteWaypoint[];
  legs: Array<{
    from: string;
    to: string;
    distanceMeters: number;
    durationMinutes: number;
  }>;
}

export function simulateRouteOptimization(
  origin: RouteWaypoint,
  waypoints: RouteWaypoint[],
): SimulatedRouteResult {
  demoLog('Simulating route optimization', {
    origin: origin.label,
    stops: waypoints.length,
  });

  // Simple nearest-neighbour ordering
  const ordered: RouteWaypoint[] = [];
  const remaining = [...waypoints];
  let current = origin;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    ordered.push(remaining[nearestIdx]);
    current = remaining[nearestIdx];
    remaining.splice(nearestIdx, 1);
  }

  // Build legs
  const legs: SimulatedRouteResult['legs'] = [];
  let totalDistance = 0;
  let totalTravel = 0;
  let prev = origin;

  for (const wp of ordered) {
    const distKm = haversineKm(prev.lat, prev.lng, wp.lat, wp.lng);
    const distMeters = Math.round(distKm * 1000);
    // Estimate ~60 km/h average for Swiss roads
    const durationMinutes = Math.round((distKm / 60) * 60);

    legs.push({
      from: prev.label,
      to: wp.label,
      distanceMeters: distMeters,
      durationMinutes: Math.max(durationMinutes, 5),
    });

    totalDistance += distMeters;
    totalTravel += Math.max(durationMinutes, 5);
    prev = wp;
  }

  return {
    totalDistanceMeters: totalDistance,
    totalTravelMinutes: totalTravel,
    orderedWaypoints: ordered,
    legs,
  };
}
