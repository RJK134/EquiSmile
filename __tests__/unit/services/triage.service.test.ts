import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockVisitRequestRepo, mockTriageTaskRepo, mockEnquiryRepo } = vi.hoisted(() => ({
  mockVisitRequestRepo: {
    findById: vi.fn(),
    update: vi.fn(),
  },
  mockTriageTaskRepo: {
    create: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findOpenTasks: vi.fn(),
  },
  mockEnquiryRepo: {
    update: vi.fn(),
  },
}));

vi.mock('@/lib/repositories/visit-request.repository', () => ({
  visitRequestRepository: mockVisitRequestRepo,
}));

vi.mock('@/lib/repositories/triage-task.repository', () => ({
  triageTaskRepository: mockTriageTaskRepo,
}));

vi.mock('@/lib/repositories/enquiry.repository', () => ({
  enquiryRepository: mockEnquiryRepo,
}));

vi.mock('@/lib/services/status-machine.service', () => ({
  validatePlanningTransition: vi.fn().mockReturnValue({ valid: true }),
  validateTriageTaskTransition: vi.fn().mockReturnValue({ valid: true }),
}));

import { triageService } from '@/lib/services/triage.service';

describe('triageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifyVisitRequest', () => {
    it('throws if visit request not found', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue(null);

      await expect(
        triageService.classifyVisitRequest('nonexistent', { urgencyLevel: 'URGENT' })
      ).rejects.toThrow('Visit request not found');
    });

    it('updates visit request with classification', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue({ id: 'vr1', enquiryId: null });
      mockVisitRequestRepo.update.mockResolvedValue({ id: 'vr1', urgencyLevel: 'URGENT' });

      await triageService.classifyVisitRequest('vr1', {
        urgencyLevel: 'URGENT',
        requestType: 'URGENT_ISSUE',
      });

      expect(mockVisitRequestRepo.update).toHaveBeenCalledWith('vr1', {
        urgencyLevel: 'URGENT',
        requestType: 'URGENT_ISSUE',
      });
    });

    it('updates enquiry to NEEDS_INFO when needsMoreInfo is true', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue({ id: 'vr1', enquiryId: 'enq1' });
      mockVisitRequestRepo.update.mockResolvedValue({ id: 'vr1' });

      await triageService.classifyVisitRequest('vr1', {
        needsMoreInfo: true,
        infoReason: 'postcode',
      });

      expect(mockEnquiryRepo.update).toHaveBeenCalledWith('enq1', { triageStatus: 'NEEDS_INFO' });
    });

    it('updates enquiry to TRIAGED when planning status changes from UNTRIAGED', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue({ id: 'vr1', enquiryId: 'enq1' });
      mockVisitRequestRepo.update.mockResolvedValue({ id: 'vr1' });

      await triageService.classifyVisitRequest('vr1', {
        planningStatus: 'PLANNING_POOL',
      });

      expect(mockEnquiryRepo.update).toHaveBeenCalledWith('enq1', { triageStatus: 'TRIAGED' });
    });

    it('creates ASK_FOR_POSTCODE triage task', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue({ id: 'vr1', enquiryId: null });
      mockVisitRequestRepo.update.mockResolvedValue({ id: 'vr1' });

      await triageService.classifyVisitRequest('vr1', {
        needsMoreInfo: true,
        infoReason: 'postcode',
      });

      expect(mockTriageTaskRepo.create).toHaveBeenCalledWith({
        visitRequestId: 'vr1',
        taskType: 'ASK_FOR_POSTCODE',
        status: 'OPEN',
      });
    });

    it('creates ASK_HORSE_COUNT triage task', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue({ id: 'vr1', enquiryId: null });
      mockVisitRequestRepo.update.mockResolvedValue({ id: 'vr1' });

      await triageService.classifyVisitRequest('vr1', {
        needsMoreInfo: true,
        infoReason: 'horse_count',
      });

      expect(mockTriageTaskRepo.create).toHaveBeenCalledWith({
        visitRequestId: 'vr1',
        taskType: 'ASK_HORSE_COUNT',
        status: 'OPEN',
      });
    });

    it('creates CLARIFY_SYMPTOMS triage task', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue({ id: 'vr1', enquiryId: null });
      mockVisitRequestRepo.update.mockResolvedValue({ id: 'vr1' });

      await triageService.classifyVisitRequest('vr1', {
        needsMoreInfo: true,
        infoReason: 'symptoms',
      });

      expect(mockTriageTaskRepo.create).toHaveBeenCalledWith({
        visitRequestId: 'vr1',
        taskType: 'CLARIFY_SYMPTOMS',
        status: 'OPEN',
      });
    });

    it('creates MANUAL_CLASSIFICATION triage task for unknown reason', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue({ id: 'vr1', enquiryId: null });
      mockVisitRequestRepo.update.mockResolvedValue({ id: 'vr1' });

      await triageService.classifyVisitRequest('vr1', {
        needsMoreInfo: true,
        infoReason: 'other',
      });

      expect(mockTriageTaskRepo.create).toHaveBeenCalledWith({
        visitRequestId: 'vr1',
        taskType: 'MANUAL_CLASSIFICATION',
        status: 'OPEN',
      });
    });

    it('does not create triage task when needsMoreInfo is false', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue({ id: 'vr1', enquiryId: null });
      mockVisitRequestRepo.update.mockResolvedValue({ id: 'vr1' });

      await triageService.classifyVisitRequest('vr1', {
        urgencyLevel: 'ROUTINE',
      });

      expect(mockTriageTaskRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('moveToPlanning', () => {
    it('updates visit request to PLANNING_POOL', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue({ id: 'vr1', planningStatus: 'UNTRIAGED' });
      mockVisitRequestRepo.update.mockResolvedValue({ id: 'vr1', planningStatus: 'PLANNING_POOL' });

      await triageService.moveToPlanning('vr1');

      expect(mockVisitRequestRepo.update).toHaveBeenCalledWith('vr1', {
        planningStatus: 'PLANNING_POOL',
        needsMoreInfo: false,
      });
    });

    it('throws if visit request not found', async () => {
      mockVisitRequestRepo.findById.mockResolvedValue(null);

      await expect(triageService.moveToPlanning('nonexistent')).rejects.toThrow('Visit request not found');
    });
  });

  describe('getTriageQueue', () => {
    it('returns open tasks', async () => {
      const tasks = [{ id: 't1', status: 'OPEN' }];
      mockTriageTaskRepo.findOpenTasks.mockResolvedValue(tasks);

      const result = await triageService.getTriageQueue();
      expect(result).toEqual(tasks);
    });
  });

  describe('completeTask', () => {
    it('marks task as DONE', async () => {
      mockTriageTaskRepo.findById.mockResolvedValue({ id: 't1', status: 'OPEN' });
      mockTriageTaskRepo.update.mockResolvedValue({ id: 't1', status: 'DONE' });

      await triageService.completeTask('t1');

      expect(mockTriageTaskRepo.update).toHaveBeenCalledWith('t1', { status: 'DONE' });
    });

    it('throws if task not found', async () => {
      mockTriageTaskRepo.findById.mockResolvedValue(null);

      await expect(triageService.completeTask('nonexistent')).rejects.toThrow('Triage task not found');
    });
  });
});
