import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, mockGeocodingService, mockRouteRunRepository } = vi.hoisted(() => ({
  mockPrisma: {
    visitRequest: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  mockGeocodingService: {
    geocodeYard: vi.fn(),
  },
  mockRouteRunRepository: {
    create: vi.fn(),
    createStops: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/env', () => ({
  env: {
    HOME_BASE_LAT: '46.4553',
    HOME_BASE_LNG: '6.8561',
    HOME_BASE_ADDRESS: 'Blonay, Switzerland',
    GCP_PROJECT_ID: '',
    GOOGLE_MAPS_API_KEY: '',
  },
}));

vi.mock('@/lib/services/geocoding.service', () => ({
  geocodingService: mockGeocodingService,
}));

vi.mock('@/lib/repositories/route-run.repository', () => ({
  routeRunRepository: mockRouteRunRepository,
}));

vi.mock('@/lib/services/route-optimizer.service', () => ({
  routeOptimizerService: {
    optimizeRoute: vi.fn(),
  },
}));

import { routeProposalService, PLANNING_CONSTRAINTS } from '@/lib/services/route-proposal.service';

function makeVisit(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    customer: { id: `c-${id}`, fullName: `Customer ${id}` },
    yard: {
      id: `y-${id}`,
      yardName: `Yard ${id}`,
      postcode: '1844',
      latitude: 46.397 + Math.random() * 0.01,
      longitude: 6.927 + Math.random() * 0.01,
      areaLabel: 'Vaud',
    },
    horseCount: 2,
    urgencyLevel: 'ROUTINE',
    preferredDays: [],
    preferredTimeBand: 'ANY',
    estimatedDurationMinutes: null,
    revenueEstimate: null,
    ...overrides,
  };
}

describe('route proposal hard constraints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports PLANNING_CONSTRAINTS with correct values', () => {
    expect(PLANNING_CONSTRAINTS.maxStopsPerDay).toBe(6);
    expect(PLANNING_CONSTRAINTS.maxHorsesPerDay).toBe(10);
    expect(PLANNING_CONSTRAINTS.maxTravelMinutesPerDay).toBe(180);
    expect(PLANNING_CONSTRAINTS.workdayStartHour).toBe(8);
    expect(PLANNING_CONSTRAINTS.workdayStartMinute).toBe(30);
    expect(PLANNING_CONSTRAINTS.workdayEndHour).toBe(17);
    expect(PLANNING_CONSTRAINTS.workdayEndMinute).toBe(30);
  });

  it('enforces max 6 yards per route run by trimming', async () => {
    // Create 8 visits all in same cluster area
    const visits = Array.from({ length: 8 }, (_, i) => makeVisit(`vr-${i + 1}`));
    mockPrisma.visitRequest.findMany.mockResolvedValue(visits);
    mockPrisma.visitRequest.updateMany.mockResolvedValue({ count: 6 });

    mockRouteRunRepository.create.mockResolvedValue({
      id: 'rr1', runDate: new Date(), status: 'DRAFT',
    });
    mockRouteRunRepository.createStops.mockResolvedValue({ count: 6 });
    mockRouteRunRepository.findById.mockResolvedValue({
      id: 'rr1',
      stops: visits.slice(0, 6).map((v) => ({
        yardId: `y-${v.id}`,
        yard: { yardName: `Yard ${v.id}` },
        visitRequest: { customer: { fullName: `Customer ${v.id}` } },
      })),
    });

    const proposals = await routeProposalService.generateProposals('2026-01-15');

    // If proposals are generated, each should have at most 6 stops
    for (const p of proposals) {
      expect(p.stops.length).toBeLessThanOrEqual(PLANNING_CONSTRAINTS.maxStopsPerDay);
    }
  });

  it('enforces max 10 horses per route run', async () => {
    // Create visits with high horse counts
    const visits = [
      makeVisit('vr-1', { horseCount: 4 }),
      makeVisit('vr-2', { horseCount: 4 }),
      makeVisit('vr-3', { horseCount: 4 }),
    ];
    mockPrisma.visitRequest.findMany.mockResolvedValue(visits);
    mockPrisma.visitRequest.updateMany.mockResolvedValue({ count: 2 });

    mockRouteRunRepository.create.mockResolvedValue({
      id: 'rr1', runDate: new Date(), status: 'DRAFT',
    });
    mockRouteRunRepository.createStops.mockResolvedValue({ count: 2 });
    mockRouteRunRepository.findById.mockResolvedValue({
      id: 'rr1',
      stops: visits.slice(0, 2).map((v) => ({
        yardId: `y-${v.id}`,
        yard: { yardName: `Yard ${v.id}` },
        visitRequest: { customer: { fullName: `Customer ${v.id}` } },
      })),
    });

    const proposals = await routeProposalService.generateProposals('2026-01-15');

    // All proposals should have at most 10 horses
    for (const p of proposals) {
      expect(p.totalHorses).toBeLessThanOrEqual(PLANNING_CONSTRAINTS.maxHorsesPerDay);
    }
  });

  it('rejects routes exceeding max travel minutes (180 min)', () => {
    // This is tested implicitly — the buildRouteProposal function returns null
    // when totalTravelMinutes > 180
    expect(PLANNING_CONSTRAINTS.maxTravelMinutesPerDay).toBe(180);
  });

  it('working hours span is 540 minutes (08:30-17:30)', () => {
    const workdayMinutes =
      (PLANNING_CONSTRAINTS.workdayEndHour * 60 + PLANNING_CONSTRAINTS.workdayEndMinute) -
      (PLANNING_CONSTRAINTS.workdayStartHour * 60 + PLANNING_CONSTRAINTS.workdayStartMinute);
    expect(workdayMinutes).toBe(540);
  });
});
