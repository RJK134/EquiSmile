import { describe, it, expect } from 'vitest';
import { haversineDistance, calculateCentroid } from '@/lib/utils/geo';

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(51.5074, -0.1278, 51.5074, -0.1278)).toBe(0);
  });

  it('calculates distance between London and Paris (~343 km)', () => {
    // London: 51.5074, -0.1278
    // Paris: 48.8566, 2.3522
    const distance = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distance).toBeGreaterThan(340);
    expect(distance).toBeLessThan(350);
  });

  it('calculates short distance between two nearby points', () => {
    // Two points ~1 km apart in London
    const distance = haversineDistance(51.5074, -0.1278, 51.5074, -0.1138);
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(2);
  });

  it('calculates distance across the equator', () => {
    const distance = haversineDistance(1, 0, -1, 0);
    expect(distance).toBeGreaterThan(220);
    expect(distance).toBeLessThan(225);
  });

  it('calculates antipodal distance (~20000 km)', () => {
    const distance = haversineDistance(0, 0, 0, 180);
    expect(distance).toBeGreaterThan(19000);
    expect(distance).toBeLessThan(21000);
  });
});

describe('calculateCentroid', () => {
  it('returns (0,0) for empty array', () => {
    expect(calculateCentroid([])).toEqual({ latitude: 0, longitude: 0 });
  });

  it('returns the point itself for a single coordinate', () => {
    expect(calculateCentroid([{ latitude: 51.5, longitude: -0.1 }])).toEqual({
      latitude: 51.5,
      longitude: -0.1,
    });
  });

  it('calculates centroid of two points', () => {
    const centroid = calculateCentroid([
      { latitude: 50, longitude: 0 },
      { latitude: 52, longitude: 2 },
    ]);
    expect(centroid.latitude).toBe(51);
    expect(centroid.longitude).toBe(1);
  });

  it('calculates centroid of multiple points', () => {
    const centroid = calculateCentroid([
      { latitude: 0, longitude: 0 },
      { latitude: 10, longitude: 10 },
      { latitude: 20, longitude: 20 },
    ]);
    expect(centroid.latitude).toBeCloseTo(10, 5);
    expect(centroid.longitude).toBeCloseTo(10, 5);
  });
});
