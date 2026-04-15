import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  simulateGeocode,
  simulateRouteOptimization,
  DEMO_LOCATIONS,
  HOME_BASE,
  type RouteWaypoint,
} from '@/lib/demo/maps-simulator';

describe('Route Planning — Integration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('geocodes Swiss yard addresses to correct coordinates', () => {
    const testCases = [
      { address: '12 Route du Lac, Villeneuve VD, 1844', expected: DEMO_LOCATIONS['Villeneuve VD'] },
      { address: '45 Avenue des Alpes, Montreux', expected: DEMO_LOCATIONS['Montreux'] },
      { address: '8 Chemin des Vignes, Aigle, VD', expected: DEMO_LOCATIONS['Aigle'] },
      { address: 'Bulle, FR', expected: DEMO_LOCATIONS['Bulle'] },
      { address: 'Route de la Gare, Château-d\'Oex', expected: DEMO_LOCATIONS['Château-d\'Oex'] },
    ];

    for (const { address, expected } of testCases) {
      const result = simulateGeocode(address);
      expect(result).not.toBeNull();
      expect(result!.latitude).toBe(expected.lat);
      expect(result!.longitude).toBe(expected.lng);
      expect(result!.partialMatch).toBe(false);
    }
  });

  it('clusters nearby yards in optimization', () => {
    const origin: RouteWaypoint = {
      lat: HOME_BASE.lat,
      lng: HOME_BASE.lng,
      label: 'Home (Blonay)',
    };

    // Nearby cluster: Villeneuve, Montreux, Aigle (all within 15km)
    const nearbyWaypoints: RouteWaypoint[] = [
      { lat: DEMO_LOCATIONS['Villeneuve VD'].lat, lng: DEMO_LOCATIONS['Villeneuve VD'].lng, label: 'Villeneuve' },
      { lat: DEMO_LOCATIONS['Montreux'].lat, lng: DEMO_LOCATIONS['Montreux'].lng, label: 'Montreux' },
      { lat: DEMO_LOCATIONS['Aigle'].lat, lng: DEMO_LOCATIONS['Aigle'].lng, label: 'Aigle' },
    ];

    const result = simulateRouteOptimization(origin, nearbyWaypoints);

    // Should be a short total distance for nearby cluster
    expect(result.totalDistanceMeters).toBeLessThan(50000); // < 50km
    expect(result.totalTravelMinutes).toBeLessThan(60); // < 1 hour
    expect(result.orderedWaypoints).toHaveLength(3);
  });

  it('handles full Vaud/Fribourg route', () => {
    const origin: RouteWaypoint = {
      lat: HOME_BASE.lat,
      lng: HOME_BASE.lng,
      label: 'Home (Blonay)',
    };

    const allWaypoints: RouteWaypoint[] = Object.entries(DEMO_LOCATIONS)
      .filter(([name]) => name !== 'Blonay')
      .map(([name, loc]) => ({
        lat: loc.lat,
        lng: loc.lng,
        label: name,
      }));

    const result = simulateRouteOptimization(origin, allWaypoints);

    expect(result.orderedWaypoints).toHaveLength(allWaypoints.length);
    expect(result.legs).toHaveLength(allWaypoints.length);

    // Total distance should be reasonable for the region (50-200km)
    const totalKm = result.totalDistanceMeters / 1000;
    expect(totalKm).toBeGreaterThan(50);
    expect(totalKm).toBeLessThan(300);
  });

  it('scores route optimization correctly', () => {
    const origin: RouteWaypoint = {
      lat: HOME_BASE.lat,
      lng: HOME_BASE.lng,
      label: 'Home',
    };

    // Efficient route: nearby stops only
    const efficient = simulateRouteOptimization(origin, [
      { lat: DEMO_LOCATIONS['Montreux'].lat, lng: DEMO_LOCATIONS['Montreux'].lng, label: 'Montreux' },
      { lat: DEMO_LOCATIONS['Villeneuve VD'].lat, lng: DEMO_LOCATIONS['Villeneuve VD'].lng, label: 'Villeneuve' },
    ]);

    // Spread route: far-flung stops
    const spread = simulateRouteOptimization(origin, [
      { lat: DEMO_LOCATIONS['Nyon'].lat, lng: DEMO_LOCATIONS['Nyon'].lng, label: 'Nyon' },
      { lat: DEMO_LOCATIONS['Avenches'].lat, lng: DEMO_LOCATIONS['Avenches'].lng, label: 'Avenches' },
    ]);

    // Efficient route should have less travel
    expect(efficient.totalDistanceMeters).toBeLessThan(spread.totalDistanceMeters);
  });
});
