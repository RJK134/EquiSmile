import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVisitRequestRepo, mockCustomerRepo } = vi.hoisted(() => ({
  mockVisitRequestRepo: {
    findForPlanningPool: vi.fn(),
    countUrgent: vi.fn(),
    countNeedsInfo: vi.fn(),
    countInPlanningPool: vi.fn(),
  },
  mockCustomerRepo: {
    count: vi.fn(),
  },
}));

vi.mock('@/lib/repositories/visit-request.repository', () => ({
  visitRequestRepository: mockVisitRequestRepo,
}));

vi.mock('@/lib/repositories/customer.repository', () => ({
  customerRepository: mockCustomerRepo,
}));

import { planningService } from '@/lib/services/planning.service';

describe('planningService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPlanningPool', () => {
    it('groups items by area label', async () => {
      mockVisitRequestRepo.findForPlanningPool.mockResolvedValue([
        { id: '1', yard: { areaLabel: 'North York', postcode: 'YO1 2AB' } },
        { id: '2', yard: { areaLabel: 'North York', postcode: 'YO1 3CD' } },
        { id: '3', yard: { areaLabel: 'South York', postcode: 'YO10 5EF' } },
      ]);

      const result = await planningService.getPlanningPool();

      expect(result).toHaveLength(2);
      expect(result[0].areaLabel).toBe('North York');
      expect(result[0].items).toHaveLength(2);
      expect(result[1].areaLabel).toBe('South York');
      expect(result[1].items).toHaveLength(1);
    });

    it('falls back to postcode prefix when no area label', async () => {
      mockVisitRequestRepo.findForPlanningPool.mockResolvedValue([
        { id: '1', yard: { areaLabel: null, postcode: 'YO1 2AB' } },
        { id: '2', yard: { areaLabel: null, postcode: 'YO1 3CD' } },
      ]);

      const result = await planningService.getPlanningPool();

      expect(result).toHaveLength(1);
      expect(result[0].areaLabel).toBe('YO1');
    });

    it('uses Unassigned for items without yard', async () => {
      mockVisitRequestRepo.findForPlanningPool.mockResolvedValue([
        { id: '1', yard: null },
      ]);

      const result = await planningService.getPlanningPool();

      expect(result).toHaveLength(1);
      expect(result[0].areaLabel).toBe('Unassigned');
    });

    it('returns empty array when no items in pool', async () => {
      mockVisitRequestRepo.findForPlanningPool.mockResolvedValue([]);

      const result = await planningService.getPlanningPool();
      expect(result).toEqual([]);
    });
  });

  describe('getDashboardStats', () => {
    it('returns aggregated stats', async () => {
      mockVisitRequestRepo.countUrgent.mockResolvedValue(2);
      mockVisitRequestRepo.countNeedsInfo.mockResolvedValue(5);
      mockVisitRequestRepo.countInPlanningPool.mockResolvedValue(8);
      mockCustomerRepo.count.mockResolvedValue(25);

      const result = await planningService.getDashboardStats();

      expect(result).toEqual({
        urgentCount: 2,
        needsInfoCount: 5,
        planningPoolCount: 8,
        activeCustomers: 25,
      });
    });
  });
});
