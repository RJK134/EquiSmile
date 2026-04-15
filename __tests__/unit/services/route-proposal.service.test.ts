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
    HOME_BASE_LAT: '51.5074',
    HOME_BASE_LNG: '-0.1278',
    HOME_BASE_ADDRESS: 'Home Base, London',
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

import { routeProposalService } from '@/lib/services/route-proposal.service';

describe('routeProposalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no eligible visit requests', async () => {
    mockPrisma.visitRequest.findMany.mockResolvedValue([]);

    const proposals = await routeProposalService.generateProposals();
    expect(proposals).toEqual([]);
  });

  it('triggers geocoding for yards missing coordinates', async () => {
    mockPrisma.visitRequest.findMany
      .mockResolvedValueOnce([
        {
          id: 'vr1',
          customer: { id: 'c1', fullName: 'John' },
          yard: {
            id: 'y1',
            yardName: 'Farm',
            postcode: 'SW1A 1AA',
            latitude: null,
            longitude: null,
            areaLabel: null,
          },
          horseCount: 2,
          urgencyLevel: 'ROUTINE',
          preferredDays: [],
          preferredTimeBand: 'ANY',
          estimatedDurationMinutes: null,
          revenueEstimate: null,
        },
      ])
      .mockResolvedValueOnce([]); // After geocoding, still no geocoded yards

    mockGeocodingService.geocodeYard.mockResolvedValue({ success: true });

    const proposals = await routeProposalService.generateProposals();
    expect(mockGeocodingService.geocodeYard).toHaveBeenCalledWith('y1');
    expect(proposals).toEqual([]);
  });

  it('generates proposals from geocoded visits', async () => {
    const mockVisits = [
      {
        id: 'vr1',
        customer: { id: 'c1', fullName: 'John' },
        yard: {
          id: 'y1',
          yardName: 'Farm A',
          postcode: 'SW1A 1AA',
          latitude: 51.50,
          longitude: -0.13,
          areaLabel: 'Westminster',
        },
        horseCount: 2,
        urgencyLevel: 'ROUTINE',
        preferredDays: [],
        preferredTimeBand: 'ANY',
        estimatedDurationMinutes: null,
        revenueEstimate: null,
      },
      {
        id: 'vr2',
        customer: { id: 'c2', fullName: 'Jane' },
        yard: {
          id: 'y2',
          yardName: 'Farm B',
          postcode: 'SW1A 2BB',
          latitude: 51.50,
          longitude: -0.14,
          areaLabel: 'Westminster',
        },
        horseCount: 3,
        urgencyLevel: 'SOON',
        preferredDays: [],
        preferredTimeBand: 'ANY',
        estimatedDurationMinutes: null,
        revenueEstimate: null,
      },
    ];

    mockPrisma.visitRequest.findMany.mockResolvedValue(mockVisits);
    mockPrisma.visitRequest.updateMany.mockResolvedValue({ count: 2 });

    mockRouteRunRepository.create.mockResolvedValue({
      id: 'rr1',
      runDate: new Date('2026-01-15'),
      status: 'DRAFT',
    });
    mockRouteRunRepository.createStops.mockResolvedValue({ count: 2 });
    mockRouteRunRepository.findById.mockResolvedValue({
      id: 'rr1',
      stops: [
        {
          yardId: 'y1',
          yard: { yardName: 'Farm A' },
          visitRequest: { customer: { fullName: 'John' } },
        },
        {
          yardId: 'y2',
          yard: { yardName: 'Farm B' },
          visitRequest: { customer: { fullName: 'Jane' } },
        },
      ],
    });

    const proposals = await routeProposalService.generateProposals('2026-01-15');
    expect(proposals.length).toBeGreaterThanOrEqual(1);
    expect(proposals[0].routeRunId).toBe('rr1');
    expect(proposals[0].status).toBe('DRAFT');
    expect(proposals[0].totalHorses).toBe(5);

    expect(mockRouteRunRepository.create).toHaveBeenCalled();
    expect(mockRouteRunRepository.createStops).toHaveBeenCalled();

    expect(mockPrisma.visitRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { planningStatus: 'CLUSTERED' },
      }),
    );
  });

  it('skips single-stop clusters with low horse count', async () => {
    const mockVisits = [
      {
        id: 'vr1',
        customer: { id: 'c1', fullName: 'John' },
        yard: {
          id: 'y1',
          yardName: 'Remote Farm',
          postcode: 'AB1 1AA',
          latitude: 57.15,
          longitude: -2.09,
          areaLabel: null,
        },
        horseCount: 1,
        urgencyLevel: 'ROUTINE',
        preferredDays: [],
        preferredTimeBand: 'ANY',
        estimatedDurationMinutes: null,
        revenueEstimate: null,
      },
    ];

    mockPrisma.visitRequest.findMany.mockResolvedValue(mockVisits);

    const proposals = await routeProposalService.generateProposals();
    expect(proposals).toEqual([]);
  });
});
