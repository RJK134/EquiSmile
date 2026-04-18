import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRouteRunRepo = {
  findById: vi.fn(),
  update: vi.fn(),
};

vi.mock('@/lib/repositories/route-run.repository', () => ({
  routeRunRepository: mockRouteRunRepo,
}));

describe('PATCH /api/route-planning/proposals/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects approval when totals cannot be derived from the route run', async () => {
    mockRouteRunRepo.findById.mockResolvedValue({
      id: 'route-1',
      totalTravelMinutes: null,
      totalVisitMinutes: null,
      totalHorses: null,
      stops: [
        {
          travelFromPrevMinutes: 20,
          serviceMinutes: null,
          visitRequest: { horseCount: 2 },
        },
      ],
    });

    const { PATCH } = await import('@/app/api/route-planning/proposals/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/route-planning/proposals/route-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'route-1' }) });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toContain('route totals are incomplete');
    expect(mockRouteRunRepo.update).not.toHaveBeenCalled();
  });

  it('derives missing totals from stops before approving a route', async () => {
    mockRouteRunRepo.findById.mockResolvedValue({
      id: 'route-2',
      totalTravelMinutes: null,
      totalVisitMinutes: null,
      totalHorses: null,
      stops: [
        {
          travelFromPrevMinutes: 20,
          serviceMinutes: 90,
          visitRequest: { horseCount: 2 },
        },
        {
          travelFromPrevMinutes: 30,
          serviceMinutes: 60,
          visitRequest: { horseCount: 3 },
        },
      ],
    });
    mockRouteRunRepo.update.mockResolvedValue({ id: 'route-2', status: 'APPROVED' });

    const { PATCH } = await import('@/app/api/route-planning/proposals/[id]/route');
    const request = new NextRequest('http://localhost:3000/api/route-planning/proposals/route-2', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'route-2' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('APPROVED');
    expect(mockRouteRunRepo.update).toHaveBeenCalledWith('route-2', {
      status: 'APPROVED',
      totalHorses: 5,
      totalTravelMinutes: 50,
      totalVisitMinutes: 150,
    });
  });
});
