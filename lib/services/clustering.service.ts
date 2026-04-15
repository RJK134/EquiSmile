/**
 * Phase 5 — Geographic Clustering Service
 *
 * Groups visit requests by geographic proximity for route planning.
 * Uses postcode prefix as primary grouping, then Haversine distance for sub-clustering.
 */

import { haversineDistance, calculateCentroid } from '@/lib/utils/geo';

export interface ClusterableVisit {
  visitRequestId: string;
  yardId: string;
  latitude: number;
  longitude: number;
  postcode: string;
  horseCount: number;
  estimatedDurationMinutes: number;
  urgencyLevel: 'URGENT' | 'SOON' | 'ROUTINE';
  preferredDays: string[];
  preferredTimeBand: string;
  revenueEstimate: number | null;
  areaLabel: string | null;
}

export interface Cluster {
  id: string;
  visitRequestIds: string[];
  visits: ClusterableVisit[];
  totalHorseCount: number;
  totalEstimatedDuration: number;
  centroid: { latitude: number; longitude: number };
  areaLabel: string;
  densityScore: number;
  averageInterStopDistanceKm: number;
  postcodePrefix: string;
}

const DEFAULT_CLUSTER_RADIUS_KM = 30;
const MIN_STOPS_PER_CLUSTER = 2;
const MIN_HORSES_FOR_SINGLE_STOP = 3;

/**
 * Extract postcode prefix (first 2-3 characters of a UK postcode).
 * UK postcodes typically start with 1-2 letters followed by 1-2 digits.
 */
function getPostcodePrefix(postcode: string): string {
  const cleaned = postcode.trim().toUpperCase();
  // Match typical UK outward code patterns: 1-2 letters + 1-2 digits
  const match = cleaned.match(/^([A-Z]{1,2}\d{1,2})/);
  return match ? match[1] : cleaned.slice(0, 3);
}

/**
 * Calculate average inter-stop distance within a set of visits.
 */
function calculateAverageInterStopDistance(visits: ClusterableVisit[]): number {
  if (visits.length < 2) return 0;

  let totalDistance = 0;
  let pairCount = 0;

  for (let i = 0; i < visits.length; i++) {
    for (let j = i + 1; j < visits.length; j++) {
      totalDistance += haversineDistance(
        visits[i].latitude,
        visits[i].longitude,
        visits[j].latitude,
        visits[j].longitude,
      );
      pairCount++;
    }
  }

  return pairCount > 0 ? totalDistance / pairCount : 0;
}

/**
 * Calculate a density score for a cluster.
 * Higher score = better cluster (more horses, closer together, higher priority).
 */
function calculateDensityScore(cluster: {
  visits: ClusterableVisit[];
  totalHorseCount: number;
  averageInterStopDistanceKm: number;
}): number {
  const { visits, totalHorseCount, averageInterStopDistanceKm } = cluster;

  // Base score from horse count
  let score = totalHorseCount * 10;

  // Bonus for number of stops
  score += visits.length * 5;

  // Penalty for distance (inverse — closer is better)
  if (averageInterStopDistanceKm > 0) {
    score -= averageInterStopDistanceKm * 2;
  }

  // Priority weighting
  for (const visit of visits) {
    if (visit.urgencyLevel === 'URGENT') score += 50;
    else if (visit.urgencyLevel === 'SOON') score += 20;
  }

  // Multi-horse yard bonus
  const multiHorseYards = visits.filter((v) => v.horseCount >= 2).length;
  score += multiHorseYards * 5;

  return Math.round(score * 100) / 100;
}

/**
 * Check if two visits have compatible availability windows.
 */
function hasCompatibleAvailability(a: ClusterableVisit, b: ClusterableVisit): boolean {
  // If either accepts ANY time band, compatible
  if (a.preferredTimeBand === 'ANY' || b.preferredTimeBand === 'ANY') return true;
  // Must match AM/PM
  if (a.preferredTimeBand !== b.preferredTimeBand) return false;

  // Check preferred days overlap (if both have preferences)
  if (a.preferredDays.length === 0 || b.preferredDays.length === 0) return true;
  return a.preferredDays.some((d) => b.preferredDays.includes(d));
}

export const clusteringService = {
  /**
   * Group visit requests into geographic clusters.
   */
  clusterVisits(
    visits: ClusterableVisit[],
    radiusKm: number = DEFAULT_CLUSTER_RADIUS_KM,
  ): Cluster[] {
    if (visits.length === 0) return [];

    // Step 1: Group by postcode prefix
    const postcodeGroups = new Map<string, ClusterableVisit[]>();
    for (const visit of visits) {
      const prefix = getPostcodePrefix(visit.postcode);
      const group = postcodeGroups.get(prefix) || [];
      group.push(visit);
      postcodeGroups.set(prefix, group);
    }

    const clusters: Cluster[] = [];
    let clusterId = 0;

    // Step 2: Within each postcode group, sub-cluster by distance
    for (const [prefix, groupVisits] of postcodeGroups.entries()) {
      const subClusters = buildDistanceClusters(groupVisits, radiusKm);

      for (const subCluster of subClusters) {
        // Filter: minimum cluster size
        const meetsMinStops = subCluster.length >= MIN_STOPS_PER_CLUSTER;
        const hasSingleHighHorse =
          subCluster.length === 1 &&
          subCluster[0].horseCount >= MIN_HORSES_FOR_SINGLE_STOP;

        if (!meetsMinStops && !hasSingleHighHorse) {
          continue;
        }

        const coordinates = subCluster.map((v) => ({
          latitude: v.latitude,
          longitude: v.longitude,
        }));
        const centroid = calculateCentroid(coordinates);
        const totalHorseCount = subCluster.reduce((sum, v) => sum + v.horseCount, 0);
        const totalEstimatedDuration = subCluster.reduce(
          (sum, v) => sum + v.estimatedDurationMinutes,
          0,
        );
        const averageDistance = calculateAverageInterStopDistance(subCluster);

        const areaLabel =
          subCluster[0].areaLabel || prefix;

        const cluster: Cluster = {
          id: `cluster-${++clusterId}`,
          visitRequestIds: subCluster.map((v) => v.visitRequestId),
          visits: subCluster,
          totalHorseCount,
          totalEstimatedDuration,
          centroid,
          areaLabel,
          densityScore: 0,
          averageInterStopDistanceKm: Math.round(averageDistance * 100) / 100,
          postcodePrefix: prefix,
        };

        cluster.densityScore = calculateDensityScore(cluster);
        clusters.push(cluster);
      }
    }

    // Sort clusters by density score (highest first)
    return clusters.sort((a, b) => b.densityScore - a.densityScore);
  },
};

/**
 * Build sub-clusters within a postcode group based on Haversine distance.
 * Uses a greedy nearest-neighbour approach.
 */
function buildDistanceClusters(
  visits: ClusterableVisit[],
  radiusKm: number,
): ClusterableVisit[][] {
  const assigned = new Set<string>();
  const clusters: ClusterableVisit[][] = [];

  // Sort by horse count descending to prefer starting with high-horse-count yards
  const sorted = [...visits].sort((a, b) => b.horseCount - a.horseCount);

  for (const seed of sorted) {
    if (assigned.has(seed.visitRequestId)) continue;

    const cluster: ClusterableVisit[] = [seed];
    assigned.add(seed.visitRequestId);

    for (const candidate of sorted) {
      if (assigned.has(candidate.visitRequestId)) continue;

      // Check distance from seed
      const dist = haversineDistance(
        seed.latitude,
        seed.longitude,
        candidate.latitude,
        candidate.longitude,
      );

      if (dist <= radiusKm && hasCompatibleAvailability(seed, candidate)) {
        cluster.push(candidate);
        assigned.add(candidate.visitRequestId);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}
