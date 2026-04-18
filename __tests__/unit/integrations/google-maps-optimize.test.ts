import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/demo/demo-mode', () => ({
  isDemoMode: vi.fn(() => false),
  demoLog: vi.fn(),
}));

vi.mock('@/lib/demo/maps-simulator', () => ({
  simulateGeocode: vi.fn(),
  simulateRouteOptimization: vi.fn(() => ({
    totalDistanceMeters: 15000,
    totalTravelMinutes: 25,
    orderedWaypoints: [],
    legs: [],
  })),
}));

vi.mock('@/lib/services/route-optimizer.service', () => ({
  routeOptimizerService: {
    optimizeRoute: vi.fn(async (stops: Array<{ visitRequestId: string }>) => ({
      visits: stops.map((s, i) => ({
        visitRequestId: s.visitRequestId,
        label: s.visitRequestId,
        sequence: i + 1,
        arrivalTime: '2026-01-15T09:30:00Z',
        departureTime: '2026-01-15T10:15:00Z',
        travelDurationSeconds: 600,
        travelDistanceMeters: 5000,
      })),
      skippedVisitRequestIds: [],
      totalDistanceMeters: 5000 * stops.length,
      totalTravelSeconds: 600 * stops.length,
    })),
    buildRequest: vi.fn(),
    parseResponse: vi.fn(),
  },
}));

import { googleMapsClient } from '@/lib/integrations/google-maps.client';
import { routeOptimizerService } from '@/lib/services/route-optimizer.service';
import { isDemoMode } from '@/lib/demo/demo-mode';
import { simulateRouteOptimization } from '@/lib/demo/maps-simulator';
import { ROUTE_PLANNING_PARAMS } from '@/lib/config/route-constraints';

describe('googleMapsClient.optimizeRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('calls real Route Optimization API when credentials are set and not in demo mode', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');
    vi.stubEnv('GCP_PROJECT_ID', 'test-project');
    vi.mocked(isDemoMode).mockReturnValue(false);

    vi.mocked(routeOptimizerService.optimizeRoute).mockResolvedValue({
      visits: [
        {
          visitRequestId: 'stop-a',
          label: 'stop-a',
          sequence: 1,
          arrivalTime: '2026-01-15T09:30:00Z',
          departureTime: '2026-01-15T10:15:00Z',
          travelDurationSeconds: 1200,
          travelDistanceMeters: 15000,
        },
      ],
      skippedVisitRequestIds: [],
      totalDistanceMeters: 15000,
      totalTravelSeconds: 1200,
    });

    const result = await googleMapsClient.optimizeRoute(
      { lat: 46.4653, lng: 6.8961, label: 'Home' },
      [{ lat: 46.397, lng: 6.9277, label: 'stop-a' }],
    );

    expect(routeOptimizerService.optimizeRoute).toHaveBeenCalled();
    expect(result.mode).toBe('live');
    expect(result.totalDistanceMeters).toBe(15000);
    expect(result.totalTravelMinutes).toBe(20); // 1200 / 60
  });

  it('falls back to local algorithm when API call fails', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');
    vi.stubEnv('GCP_PROJECT_ID', 'test-project');
    vi.mocked(isDemoMode).mockReturnValue(false);

    vi.mocked(routeOptimizerService.optimizeRoute).mockRejectedValue(
      new Error('API error: 503'),
    );

    const result = await googleMapsClient.optimizeRoute(
      { lat: 46.4653, lng: 6.8961, label: 'Home' },
      [{ lat: 46.397, lng: 6.9277, label: 'stop-a' }],
    );

    // Should have fallen back to simulateRouteOptimization
    expect(simulateRouteOptimization).toHaveBeenCalled();
    expect(result.mode).toBe('live'); // still live mode, just fallback algo
  });

  it('uses local algorithm in demo mode', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');
    vi.stubEnv('GCP_PROJECT_ID', 'test-project');
    vi.mocked(isDemoMode).mockReturnValue(true);

    const result = await googleMapsClient.optimizeRoute(
      { lat: 46.4653, lng: 6.8961, label: 'Home' },
      [{ lat: 46.397, lng: 6.9277, label: 'stop-a' }],
    );

    expect(routeOptimizerService.optimizeRoute).not.toHaveBeenCalled();
    expect(simulateRouteOptimization).toHaveBeenCalled();
    expect(result.mode).toBe('demo');
  });

  it('uses local algorithm when GCP_PROJECT_ID is missing', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');
    vi.stubEnv('GCP_PROJECT_ID', '');
    vi.mocked(isDemoMode).mockReturnValue(false);

    await googleMapsClient.optimizeRoute(
      { lat: 46.4653, lng: 6.8961, label: 'Home' },
      [{ lat: 46.397, lng: 6.9277, label: 'stop-a' }],
    );

    // Without GCP_PROJECT_ID, should not call the real API
    expect(routeOptimizerService.optimizeRoute).not.toHaveBeenCalled();
    expect(simulateRouteOptimization).toHaveBeenCalled();
  });
});

describe('googleMapsClient.optimizeRoute — data mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  function getPassedStops(): Array<{ serviceDurationSeconds: number; visitRequestId: string }> {
    const calls = vi.mocked(routeOptimizerService.optimizeRoute).mock.calls;
    if (calls.length === 0) return [];
    return calls[0][0] as Array<{ serviceDurationSeconds: number; visitRequestId: string }>;
  }

  it('calculates service duration from horseCount (30 min/horse + 15 min buffer)', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');
    vi.stubEnv('GCP_PROJECT_ID', 'test-project');
    vi.mocked(isDemoMode).mockReturnValue(false);

    await googleMapsClient.optimizeRoute(
      { lat: 46.4653, lng: 6.8961, label: 'Home' },
      [
        { lat: 46.397, lng: 6.9277, label: 'yard-a', horseCount: 3 },
        { lat: 46.431, lng: 6.9107, label: 'yard-b', horseCount: 1 },
      ],
    );

    expect(routeOptimizerService.optimizeRoute).toHaveBeenCalled();
    const stops = getPassedStops();

    // yard-a: 3 horses × 30 min + 15 min buffer = 105 min = 6300 seconds
    const yardA = stops.find((s) => s.visitRequestId === 'yard-a');
    expect(yardA).toBeDefined();
    const expectedA =
      (3 * ROUTE_PLANNING_PARAMS.standardServiceMinutesPerHorse +
        ROUTE_PLANNING_PARAMS.bufferMinutesPerStop) * 60;
    expect(yardA!.serviceDurationSeconds).toBe(expectedA);

    // yard-b: 1 horse × 30 min + 15 min buffer = 45 min = 2700 seconds
    const yardB = stops.find((s) => s.visitRequestId === 'yard-b');
    expect(yardB).toBeDefined();
    const expectedB =
      (1 * ROUTE_PLANNING_PARAMS.standardServiceMinutesPerHorse +
        ROUTE_PLANNING_PARAMS.bufferMinutesPerStop) * 60;
    expect(yardB!.serviceDurationSeconds).toBe(expectedB);
  });

  it('defaults to 1 horse when horseCount is not provided', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');
    vi.stubEnv('GCP_PROJECT_ID', 'test-project');
    vi.mocked(isDemoMode).mockReturnValue(false);

    await googleMapsClient.optimizeRoute(
      { lat: 46.4653, lng: 6.8961, label: 'Home' },
      [{ lat: 46.397, lng: 6.9277, label: 'yard-x' }],
    );

    const stops = getPassedStops();
    expect(stops).toHaveLength(1);
    // 1 horse × 30 min + 15 min buffer = 45 min = 2700 seconds
    const expected =
      (1 * ROUTE_PLANNING_PARAMS.standardServiceMinutesPerHorse +
        ROUTE_PLANNING_PARAMS.bufferMinutesPerStop) * 60;
    expect(stops[0].serviceDurationSeconds).toBe(expected);
  });

  it('maps waypoint labels to visitRequestId', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');
    vi.stubEnv('GCP_PROJECT_ID', 'test-project');
    vi.mocked(isDemoMode).mockReturnValue(false);

    await googleMapsClient.optimizeRoute(
      { lat: 46.4653, lng: 6.8961, label: 'Home' },
      [
        { lat: 46.397, lng: 6.9277, label: 'vr-001' },
        { lat: 46.431, lng: 6.9107, label: 'vr-002' },
      ],
    );

    const stops = getPassedStops();
    expect(stops.map((s) => s.visitRequestId)).toEqual(['vr-001', 'vr-002']);
  });

  it('sets vehicle start/end at home base coordinates', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-api-key');
    vi.stubEnv('GCP_PROJECT_ID', 'test-project');
    vi.mocked(isDemoMode).mockReturnValue(false);

    await googleMapsClient.optimizeRoute(
      { lat: 46.4553, lng: 6.8561, label: 'Home' },
      [{ lat: 46.397, lng: 6.9277, label: 'stop-a' }],
    );

    // Verify the vehicle argument passed to routeOptimizerService
    const calls = vi.mocked(routeOptimizerService.optimizeRoute).mock.calls;
    expect(calls).toHaveLength(1);
    const vehicle = calls[0][1] as { startLatitude: number; startLongitude: number; endLatitude: number; endLongitude: number };
    expect(vehicle.startLatitude).toBe(46.4553);
    expect(vehicle.startLongitude).toBe(6.8561);
    expect(vehicle.endLatitude).toBe(46.4553);
    expect(vehicle.endLongitude).toBe(6.8561);
  });
});
