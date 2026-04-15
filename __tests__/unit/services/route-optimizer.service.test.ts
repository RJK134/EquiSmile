import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    GCP_PROJECT_ID: 'test-project',
    GOOGLE_MAPS_API_KEY: 'test-key',
    GOOGLE_APPLICATION_CREDENTIALS: '',
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { routeOptimizerService, type OptimizationStop } from '@/lib/services/route-optimizer.service';

const sampleStops: OptimizationStop[] = [
  {
    visitRequestId: 'vr1',
    yardId: 'yard1',
    latitude: 51.5,
    longitude: -0.1,
    serviceDurationSeconds: 1800,
    timeWindowStart: '2026-01-15T09:00:00Z',
    timeWindowEnd: '2026-01-15T12:00:00Z',
    label: 'vr1',
  },
  {
    visitRequestId: 'vr2',
    yardId: 'yard2',
    latitude: 51.6,
    longitude: -0.2,
    serviceDurationSeconds: 2700,
    timeWindowStart: '2026-01-15T09:00:00Z',
    timeWindowEnd: '2026-01-15T17:00:00Z',
    label: 'vr2',
  },
];

const sampleVehicle = {
  startLatitude: 51.4,
  startLongitude: -0.05,
  endLatitude: 51.4,
  endLongitude: -0.05,
  startTime: '2026-01-15T08:30:00Z',
  endTime: '2026-01-15T17:30:00Z',
};

describe('routeOptimizerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildRequest', () => {
    it('creates valid optimizeTours request payload', () => {
      const request = routeOptimizerService.buildRequest(sampleStops, sampleVehicle);

      expect(request.model.shipments).toHaveLength(2);
      expect(request.model.vehicles).toHaveLength(1);
      expect(request.searchMode).toBe('RETURN_FAST');
    });

    it('maps stops to shipments correctly', () => {
      const request = routeOptimizerService.buildRequest(sampleStops, sampleVehicle);
      const shipment = request.model.shipments[0];

      expect(shipment.label).toBe('vr1');
      expect(shipment.pickups[0].arrivalLocation).toEqual({
        latitude: 51.5,
        longitude: -0.1,
      });
      expect(shipment.pickups[0].duration).toBe('1800s');
      expect(shipment.pickups[0].timeWindows[0]).toEqual({
        startTime: '2026-01-15T09:00:00Z',
        endTime: '2026-01-15T12:00:00Z',
      });
    });

    it('sets vehicle start/end locations correctly', () => {
      const request = routeOptimizerService.buildRequest(sampleStops, sampleVehicle);
      const vehicle = request.model.vehicles[0];

      expect(vehicle.startLocation).toEqual({ latitude: 51.4, longitude: -0.05 });
      expect(vehicle.endLocation).toEqual({ latitude: 51.4, longitude: -0.05 });
      expect(vehicle.travelMode).toBe('DRIVING');
      expect(vehicle.costPerKilometer).toBe(0.5);
      expect(vehicle.costPerHour).toBe(1.0);
    });

    it('handles empty stops array', () => {
      const request = routeOptimizerService.buildRequest([], sampleVehicle);
      expect(request.model.shipments).toHaveLength(0);
      expect(request.model.vehicles).toHaveLength(1);
    });
  });

  describe('parseResponse', () => {
    it('parses a successful response with visits', () => {
      const response = {
        routes: [{
          visits: [
            { shipmentIndex: 0, startTime: '2026-01-15T09:30:00Z' },
            { shipmentIndex: 1, startTime: '2026-01-15T11:00:00Z' },
          ],
          transitions: [
            { travelDuration: '0s', travelDistanceMeters: 0 },
            { travelDuration: '1200s', travelDistanceMeters: 15000 },
            { travelDuration: '900s', travelDistanceMeters: 12000 },
          ],
        }],
      };

      const result = routeOptimizerService.parseResponse(response, sampleStops);
      expect(result.visits).toHaveLength(2);
      expect(result.visits[0].visitRequestId).toBe('vr1');
      expect(result.visits[0].sequence).toBe(1);
      expect(result.visits[0].arrivalTime).toBe('2026-01-15T09:30:00Z');
      expect(result.visits[1].sequence).toBe(2);
      expect(result.totalDistanceMeters).toBe(27000);
      expect(result.totalTravelSeconds).toBe(2100);
    });

    it('handles skipped shipments', () => {
      const response = {
        routes: [{
          visits: [
            { shipmentIndex: 0, startTime: '2026-01-15T09:30:00Z' },
          ],
          transitions: [
            { travelDuration: '0s', travelDistanceMeters: 0 },
            { travelDuration: '600s', travelDistanceMeters: 8000 },
          ],
        }],
        skippedShipments: [
          { index: 1, label: 'vr2' },
        ],
      };

      const result = routeOptimizerService.parseResponse(response, sampleStops);
      expect(result.visits).toHaveLength(1);
      expect(result.skippedVisitRequestIds).toEqual(['vr2']);
    });

    it('handles empty response', () => {
      const result = routeOptimizerService.parseResponse({}, sampleStops);
      expect(result.visits).toHaveLength(0);
      expect(result.skippedVisitRequestIds).toHaveLength(0);
      expect(result.totalDistanceMeters).toBe(0);
      expect(result.totalTravelSeconds).toBe(0);
    });

    it('handles missing transitions gracefully', () => {
      const response = {
        routes: [{
          visits: [
            { shipmentIndex: 0, startTime: '2026-01-15T09:30:00Z' },
          ],
        }],
      };

      const result = routeOptimizerService.parseResponse(response, sampleStops);
      expect(result.visits).toHaveLength(1);
      expect(result.visits[0].travelDurationSeconds).toBe(0);
      expect(result.visits[0].travelDistanceMeters).toBe(0);
    });
  });

  describe('optimizeRoute', () => {
    it('calls API with correct URL and payload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          routes: [{
            visits: [{ shipmentIndex: 0, startTime: '2026-01-15T09:30:00Z' }],
            transitions: [
              { travelDuration: '0s', travelDistanceMeters: 0 },
              { travelDuration: '600s', travelDistanceMeters: 5000 },
            ],
          }],
        }),
      });

      await routeOptimizerService.optimizeRoute(sampleStops, sampleVehicle);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('routeoptimization.googleapis.com/v1/projects/test-project:optimizeTours'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('throws on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      await expect(
        routeOptimizerService.optimizeRoute(sampleStops, sampleVehicle),
      ).rejects.toThrow('route-optimization failed after');
    });
  });
});
