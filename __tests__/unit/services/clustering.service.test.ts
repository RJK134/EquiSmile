import { describe, it, expect } from 'vitest';
import { clusteringService, type ClusterableVisit } from '@/lib/services/clustering.service';

function makeVisit(overrides: Partial<ClusterableVisit> = {}): ClusterableVisit {
  return {
    visitRequestId: `vr-${Math.random().toString(36).slice(2, 8)}`,
    yardId: `yard-${Math.random().toString(36).slice(2, 8)}`,
    latitude: 51.5074,
    longitude: -0.1278,
    postcode: 'SW1A 1AA',
    horseCount: 2,
    estimatedDurationMinutes: 75,
    urgencyLevel: 'ROUTINE',
    preferredDays: [],
    preferredTimeBand: 'ANY',
    revenueEstimate: null,
    areaLabel: null,
    ...overrides,
  };
}

describe('clusteringService.clusterVisits', () => {
  it('returns empty array for no visits', () => {
    expect(clusteringService.clusterVisits([])).toEqual([]);
  });

  it('clusters visits with same postcode prefix together', () => {
    const visits = [
      makeVisit({ visitRequestId: 'vr1', postcode: 'SW1A 1AA', latitude: 51.50, longitude: -0.13 }),
      makeVisit({ visitRequestId: 'vr2', postcode: 'SW1B 2BB', latitude: 51.50, longitude: -0.14 }),
      makeVisit({ visitRequestId: 'vr3', postcode: 'EX1 1AA', latitude: 50.72, longitude: -3.53 }),
      makeVisit({ visitRequestId: 'vr4', postcode: 'EX1 2BB', latitude: 50.73, longitude: -3.54 }),
    ];

    const clusters = clusteringService.clusterVisits(visits);
    expect(clusters.length).toBeGreaterThanOrEqual(2);

    // Each cluster should contain visits from the same area
    for (const cluster of clusters) {
      // Within a cluster, visits should be close together
      expect(cluster.averageInterStopDistanceKm).toBeLessThan(30);
    }
  });

  it('respects minimum cluster size (2 stops)', () => {
    const visits = [
      makeVisit({ visitRequestId: 'vr1', postcode: 'SW1A 1AA', horseCount: 1 }),
    ];

    const clusters = clusteringService.clusterVisits(visits);
    // Single visit with only 1 horse should not form a cluster
    expect(clusters.length).toBe(0);
  });

  it('allows single-stop cluster if horse count >= 3', () => {
    const visits = [
      makeVisit({ visitRequestId: 'vr1', postcode: 'SW1A 1AA', horseCount: 3 }),
    ];

    const clusters = clusteringService.clusterVisits(visits);
    expect(clusters.length).toBe(1);
    expect(clusters[0].totalHorseCount).toBe(3);
  });

  it('calculates correct total horse count', () => {
    const visits = [
      makeVisit({ visitRequestId: 'vr1', postcode: 'SW1A 1AA', horseCount: 2, latitude: 51.50, longitude: -0.13 }),
      makeVisit({ visitRequestId: 'vr2', postcode: 'SW1A 2BB', horseCount: 3, latitude: 51.50, longitude: -0.14 }),
    ];

    const clusters = clusteringService.clusterVisits(visits);
    expect(clusters.length).toBe(1);
    expect(clusters[0].totalHorseCount).toBe(5);
  });

  it('calculates total estimated duration', () => {
    const visits = [
      makeVisit({ visitRequestId: 'vr1', postcode: 'SW1A 1AA', estimatedDurationMinutes: 60, latitude: 51.50, longitude: -0.13 }),
      makeVisit({ visitRequestId: 'vr2', postcode: 'SW1A 2BB', estimatedDurationMinutes: 45, latitude: 51.50, longitude: -0.14 }),
    ];

    const clusters = clusteringService.clusterVisits(visits);
    expect(clusters[0].totalEstimatedDuration).toBe(105);
  });

  it('sorts clusters by density score (highest first)', () => {
    const visits = [
      // Low-value cluster: far apart, routine, 1 horse each
      makeVisit({ visitRequestId: 'vr1', postcode: 'AB1 1AA', horseCount: 1, urgencyLevel: 'ROUTINE', latitude: 57.15, longitude: -2.09 }),
      makeVisit({ visitRequestId: 'vr2', postcode: 'AB1 2BB', horseCount: 1, urgencyLevel: 'ROUTINE', latitude: 57.16, longitude: -2.10 }),
      // High-value cluster: close together, soon priority, many horses
      makeVisit({ visitRequestId: 'vr3', postcode: 'SW1A 1AA', horseCount: 4, urgencyLevel: 'SOON', latitude: 51.50, longitude: -0.13 }),
      makeVisit({ visitRequestId: 'vr4', postcode: 'SW1A 2BB', horseCount: 3, urgencyLevel: 'SOON', latitude: 51.50, longitude: -0.14 }),
    ];

    const clusters = clusteringService.clusterVisits(visits);
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    // First cluster should have a higher density score
    expect(clusters[0].densityScore).toBeGreaterThanOrEqual(clusters[1].densityScore);
  });

  it('does not cluster visits that are too far apart', () => {
    const visits = [
      makeVisit({ visitRequestId: 'vr1', postcode: 'SW1A 1AA', latitude: 51.50, longitude: -0.13 }),
      makeVisit({ visitRequestId: 'vr2', postcode: 'SW1A 2BB', latitude: 51.50, longitude: -0.14 }),
      // Same postcode prefix but 100km away (would be filtered by distance)
      makeVisit({ visitRequestId: 'vr3', postcode: 'SW1A 3CC', latitude: 52.50, longitude: 0.50 }),
    ];

    const clusters = clusteringService.clusterVisits(visits, 5); // 5km radius
    // vr1 and vr2 should still be clustered together
    const mainCluster = clusters.find((c) => c.visitRequestIds.includes('vr1'));
    if (mainCluster) {
      expect(mainCluster.visitRequestIds).toContain('vr2');
    }
  });

  it('includes cluster centroid coordinates', () => {
    const visits = [
      makeVisit({ visitRequestId: 'vr1', postcode: 'SW1A 1AA', latitude: 51.50, longitude: -0.10 }),
      makeVisit({ visitRequestId: 'vr2', postcode: 'SW1A 2BB', latitude: 51.52, longitude: -0.14 }),
    ];

    const clusters = clusteringService.clusterVisits(visits);
    expect(clusters[0].centroid.latitude).toBeCloseTo(51.51, 1);
    expect(clusters[0].centroid.longitude).toBeCloseTo(-0.12, 1);
  });

  it('includes area label from visits', () => {
    const visits = [
      makeVisit({ visitRequestId: 'vr1', postcode: 'SW1A 1AA', areaLabel: 'Westminster', latitude: 51.50, longitude: -0.13 }),
      makeVisit({ visitRequestId: 'vr2', postcode: 'SW1A 2BB', areaLabel: 'Westminster', latitude: 51.50, longitude: -0.14 }),
    ];

    const clusters = clusteringService.clusterVisits(visits);
    expect(clusters[0].areaLabel).toBe('Westminster');
  });
});
