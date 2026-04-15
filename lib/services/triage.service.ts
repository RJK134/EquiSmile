import { visitRequestRepository } from '@/lib/repositories/visit-request.repository';
import { triageTaskRepository } from '@/lib/repositories/triage-task.repository';
import { enquiryRepository } from '@/lib/repositories/enquiry.repository';
import { validatePlanningTransition, validateTriageTaskTransition } from './status-machine.service';
import type { UrgencyLevel, RequestType, PlanningStatus } from '@prisma/client';

export const triageService = {
  async classifyVisitRequest(
    visitRequestId: string,
    classification: {
      urgencyLevel?: UrgencyLevel;
      requestType?: RequestType;
      planningStatus?: PlanningStatus;
      needsMoreInfo?: boolean;
      infoReason?: string;
    }
  ) {
    const vr = await visitRequestRepository.findById(visitRequestId);
    if (!vr) throw new Error('Visit request not found');

    const updateData: Record<string, unknown> = {};
    if (classification.urgencyLevel) updateData.urgencyLevel = classification.urgencyLevel;
    if (classification.requestType) updateData.requestType = classification.requestType;
    if (classification.planningStatus) updateData.planningStatus = classification.planningStatus;
    if (classification.needsMoreInfo !== undefined) updateData.needsMoreInfo = classification.needsMoreInfo;

    const updated = await visitRequestRepository.update(visitRequestId, updateData);

    // Update enquiry triage status
    if (vr.enquiryId) {
      if (classification.needsMoreInfo) {
        await enquiryRepository.update(vr.enquiryId, { triageStatus: 'NEEDS_INFO' });
      } else if (classification.planningStatus && classification.planningStatus !== 'UNTRIAGED') {
        await enquiryRepository.update(vr.enquiryId, { triageStatus: 'TRIAGED' });
      }
    }

    // If needs more info, create triage task
    if (classification.needsMoreInfo && classification.infoReason) {
      const taskType = classification.infoReason === 'postcode' ? 'ASK_FOR_POSTCODE'
        : classification.infoReason === 'horse_count' ? 'ASK_HORSE_COUNT'
        : classification.infoReason === 'symptoms' ? 'CLARIFY_SYMPTOMS'
        : 'MANUAL_CLASSIFICATION';

      await triageTaskRepository.create({
        visitRequestId,
        taskType,
        status: 'OPEN',
      });
    }

    return updated;
  },

  async moveToPlanning(visitRequestId: string) {
    const vr = await visitRequestRepository.findById(visitRequestId);
    if (!vr) throw new Error('Visit request not found');

    const validation = validatePlanningTransition(vr.planningStatus, 'PLANNING_POOL');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return visitRequestRepository.update(visitRequestId, {
      planningStatus: 'PLANNING_POOL',
      needsMoreInfo: false,
    });
  },

  async getTriageQueue() {
    return triageTaskRepository.findOpenTasks();
  },

  async completeTask(taskId: string) {
    const task = await triageTaskRepository.findById(taskId);
    if (!task) throw new Error('Triage task not found');

    const validation = validateTriageTaskTransition(task.status, 'DONE');
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    return triageTaskRepository.update(taskId, { status: 'DONE' });
  },
};
