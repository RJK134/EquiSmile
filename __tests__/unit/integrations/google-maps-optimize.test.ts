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
    optimizeRoute: vi.fn(),
    buildRequest: vi.fn(),
    parseResponse: vi.fn(),
  },
}));

import { googleMapsClient } from '@/lib/integrations/google-maps.client';
import { routeOptimizerService } from '@/lib/services/route-optimizer.service';
import { isDemoMode } from '@/lib/demo/demo-mode';
import { simulateRouteOptimization } from '@/lib/demo/maps-simulator';

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
