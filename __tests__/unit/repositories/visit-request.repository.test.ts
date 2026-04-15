import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    visitRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { visitRequestRepository } from '@/lib/repositories/visit-request.repository';

describe('visitRequestRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findMany', () => {
    it('returns paginated visit requests', async () => {
      const items = [{ id: '1', requestType: 'ROUTINE_DENTAL' }];
      mockPrisma.visitRequest.findMany.mockResolvedValue(items);
      mockPrisma.visitRequest.count.mockResolvedValue(1);

      const result = await visitRequestRepository.findMany({ page: 1, pageSize: 20 });

      expect(result.data).toEqual(items);
      expect(result.total).toBe(1);
    });

    it('filters by planning status', async () => {
      mockPrisma.visitRequest.findMany.mockResolvedValue([]);
      mockPrisma.visitRequest.count.mockResolvedValue(0);

      await visitRequestRepository.findMany({
        planningStatus: 'PLANNING_POOL',
        page: 1,
        pageSize: 20,
      });

      const call = mockPrisma.visitRequest.findMany.mock.calls[0][0];
      expect(call.where.planningStatus).toBe('PLANNING_POOL');
    });

    it('filters by urgency level', async () => {
      mockPrisma.visitRequest.findMany.mockResolvedValue([]);
      mockPrisma.visitRequest.count.mockResolvedValue(0);

      await visitRequestRepository.findMany({
        urgencyLevel: 'URGENT',
        page: 1,
        pageSize: 20,
      });

      const call = mockPrisma.visitRequest.findMany.mock.calls[0][0];
      expect(call.where.urgencyLevel).toBe('URGENT');
    });
  });

  describe('findForPlanningPool', () => {
    it('queries for PLANNING_POOL and READY_FOR_REVIEW statuses', async () => {
      mockPrisma.visitRequest.findMany.mockResolvedValue([]);

      await visitRequestRepository.findForPlanningPool();

      const call = mockPrisma.visitRequest.findMany.mock.calls[0][0];
      expect(call.where.planningStatus.in).toEqual(['PLANNING_POOL', 'READY_FOR_REVIEW']);
    });
  });

  describe('countUrgent', () => {
    it('counts urgent non-completed requests', async () => {
      mockPrisma.visitRequest.count.mockResolvedValue(3);

      const result = await visitRequestRepository.countUrgent();

      expect(result).toBe(3);
      const call = mockPrisma.visitRequest.count.mock.calls[0][0];
      expect(call.where.urgencyLevel).toBe('URGENT');
      expect(call.where.planningStatus.notIn).toContain('COMPLETED');
      expect(call.where.planningStatus.notIn).toContain('CANCELLED');
    });
  });

  describe('countNeedsInfo', () => {
    it('counts requests needing more info', async () => {
      mockPrisma.visitRequest.count.mockResolvedValue(5);

      const result = await visitRequestRepository.countNeedsInfo();

      expect(result).toBe(5);
      const call = mockPrisma.visitRequest.count.mock.calls[0][0];
      expect(call.where.needsMoreInfo).toBe(true);
    });
  });

  describe('countInPlanningPool', () => {
    it('counts requests in planning pool', async () => {
      mockPrisma.visitRequest.count.mockResolvedValue(10);

      const result = await visitRequestRepository.countInPlanningPool();

      expect(result).toBe(10);
      const call = mockPrisma.visitRequest.count.mock.calls[0][0];
      expect(call.where.planningStatus.in).toEqual(['PLANNING_POOL', 'READY_FOR_REVIEW']);
    });
  });
});
