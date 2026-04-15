import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  visitRequest: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  triageTask: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  triageAuditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  enquiry: {
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/services/status-machine.service', () => ({
  validatePlanningTransition: vi.fn().mockReturnValue({ valid: true }),
}));

import { overrideService } from '@/lib/services/override.service';
import { validatePlanningTransition } from '@/lib/services/status-machine.service';

describe('override.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('overrideUrgency', () => {
    it('updates urgency and creates audit log', async () => {
      mockPrisma.visitRequest.findUnique.mockResolvedValue({
        id: 'vr1',
        urgencyLevel: 'ROUTINE',
      });
      mockPrisma.visitRequest.update.mockResolvedValue({
        id: 'vr1',
        urgencyLevel: 'URGENT',
      });
      mockPrisma.triageAuditLog.create.mockResolvedValue({ id: 'log1' });

      await overrideService.overrideUrgency({
        visitRequestId: 'vr1',
        urgencyLevel: 'URGENT',
        reason: 'Customer called back with worsening symptoms',
        performedBy: 'admin',
      });

      expect(mockPrisma.visitRequest.update).toHaveBeenCalledWith({
        where: { id: 'vr1' },
        data: { urgencyLevel: 'URGENT' },
      });
      expect(mockPrisma.triageAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          visitRequestId: 'vr1',
          action: 'OVERRIDE_URGENCY',
          field: 'urgencyLevel',
          previousValue: 'ROUTINE',
          newValue: 'URGENT',
          reason: 'Customer called back with worsening symptoms',
        }),
      });
    });

    it('throws if visit request not found', async () => {
      mockPrisma.visitRequest.findUnique.mockResolvedValue(null);

      await expect(
        overrideService.overrideUrgency({
          visitRequestId: 'nonexistent',
          urgencyLevel: 'URGENT',
          reason: 'test',
        })
      ).rejects.toThrow('Visit request not found');
    });
  });

  describe('overrideRequestType', () => {
    it('updates request type and creates audit log', async () => {
      mockPrisma.visitRequest.findUnique.mockResolvedValue({
        id: 'vr1',
        requestType: 'ROUTINE_DENTAL',
      });
      mockPrisma.visitRequest.update.mockResolvedValue({
        id: 'vr1',
        requestType: 'FIRST_VISIT',
      });
      mockPrisma.triageAuditLog.create.mockResolvedValue({ id: 'log1' });

      await overrideService.overrideRequestType({
        visitRequestId: 'vr1',
        requestType: 'FIRST_VISIT',
        reason: 'Actually a new horse not in system',
      });

      expect(mockPrisma.triageAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'OVERRIDE_REQUEST_TYPE',
          field: 'requestType',
          previousValue: 'ROUTINE_DENTAL',
          newValue: 'FIRST_VISIT',
        }),
      });
    });
  });

  describe('overridePlanningStatus', () => {
    it('validates transition before applying', async () => {
      mockPrisma.visitRequest.findUnique.mockResolvedValue({
        id: 'vr1',
        planningStatus: 'UNTRIAGED',
      });
      mockPrisma.visitRequest.update.mockResolvedValue({
        id: 'vr1',
        planningStatus: 'PLANNING_POOL',
      });
      mockPrisma.triageAuditLog.create.mockResolvedValue({ id: 'log1' });

      await overrideService.overridePlanningStatus({
        visitRequestId: 'vr1',
        planningStatus: 'PLANNING_POOL',
        reason: 'Ready for planning',
      });

      expect(validatePlanningTransition).toHaveBeenCalledWith('UNTRIAGED', 'PLANNING_POOL');
    });

    it('rejects invalid transition', async () => {
      mockPrisma.visitRequest.findUnique.mockResolvedValue({
        id: 'vr1',
        planningStatus: 'COMPLETED',
      });

      vi.mocked(validatePlanningTransition).mockReturnValueOnce({
        valid: false,
        error: 'Invalid planning status transition: COMPLETED → UNTRIAGED',
      });

      await expect(
        overrideService.overridePlanningStatus({
          visitRequestId: 'vr1',
          planningStatus: 'UNTRIAGED',
          reason: 'test',
        })
      ).rejects.toThrow('Invalid planning status transition');
    });
  });

  describe('forceToPool', () => {
    it('sets PLANNING_POOL, clears needsMoreInfo, closes tasks', async () => {
      mockPrisma.visitRequest.findUnique.mockResolvedValue({
        id: 'vr1',
        planningStatus: 'UNTRIAGED',
        enquiryId: 'enq1',
      });
      mockPrisma.visitRequest.update.mockResolvedValue({ id: 'vr1' });
      mockPrisma.triageTask.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.enquiry.update.mockResolvedValue({ id: 'enq1' });
      mockPrisma.triageAuditLog.create.mockResolvedValue({ id: 'log1' });

      await overrideService.forceToPool({
        visitRequestId: 'vr1',
        reason: 'Admin skip',
      });

      expect(mockPrisma.visitRequest.update).toHaveBeenCalledWith({
        where: { id: 'vr1' },
        data: { planningStatus: 'PLANNING_POOL', needsMoreInfo: false },
      });
      expect(mockPrisma.triageTask.updateMany).toHaveBeenCalledWith({
        where: { visitRequestId: 'vr1', status: { in: ['OPEN', 'IN_PROGRESS'] } },
        data: { status: 'DONE', notes: 'Auto-closed: forced to planning pool' },
      });
      expect(mockPrisma.enquiry.update).toHaveBeenCalledWith({
        where: { id: 'enq1' },
        data: { triageStatus: 'TRIAGED' },
      });
    });
  });

  describe('forceToUrgentReview', () => {
    it('sets READY_FOR_REVIEW and creates URGENT_REVIEW task', async () => {
      mockPrisma.visitRequest.findUnique.mockResolvedValue({
        id: 'vr1',
        planningStatus: 'UNTRIAGED',
      });
      mockPrisma.visitRequest.update.mockResolvedValue({ id: 'vr1' });
      mockPrisma.triageTask.create.mockResolvedValue({ id: 'task1' });
      mockPrisma.triageAuditLog.create.mockResolvedValue({ id: 'log1' });

      await overrideService.forceToUrgentReview({
        visitRequestId: 'vr1',
        reason: 'Customer called back',
      });

      expect(mockPrisma.visitRequest.update).toHaveBeenCalledWith({
        where: { id: 'vr1' },
        data: { planningStatus: 'READY_FOR_REVIEW', urgencyLevel: 'URGENT' },
      });
      expect(mockPrisma.triageTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          visitRequestId: 'vr1',
          taskType: 'URGENT_REVIEW',
          status: 'OPEN',
        }),
      });
    });
  });

  describe('getAuditHistory', () => {
    it('returns audit logs for visit request', async () => {
      const logs = [
        { id: 'log1', action: 'OVERRIDE_URGENCY', createdAt: new Date() },
        { id: 'log2', action: 'FORCE_TO_POOL', createdAt: new Date() },
      ];
      mockPrisma.triageAuditLog.findMany.mockResolvedValue(logs);

      const result = await overrideService.getAuditHistory('vr1');
      expect(result).toEqual(logs);
      expect(mockPrisma.triageAuditLog.findMany).toHaveBeenCalledWith({
        where: { visitRequestId: 'vr1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
