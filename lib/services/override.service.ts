/**
 * Phase 4 — Manual Override and Escalation Service
 *
 * Provides override actions for visit requests with audit trail logging.
 * All overrides are recorded in the TriageAuditLog for accountability.
 */

import { prisma } from '@/lib/prisma';
import { validatePlanningTransition } from './status-machine.service';
import type { UrgencyLevel, RequestType, PlanningStatus } from '@prisma/client';

export interface OverrideInput {
  visitRequestId: string;
  performedBy?: string;
  reason: string;
}

export interface OverrideUrgencyInput extends OverrideInput {
  urgencyLevel: UrgencyLevel;
}

export interface OverrideRequestTypeInput extends OverrideInput {
  requestType: RequestType;
}

export interface OverridePlanningStatusInput extends OverrideInput {
  planningStatus: PlanningStatus;
}

async function createAuditLog(
  visitRequestId: string,
  action: string,
  field: string,
  previousValue: string | null,
  newValue: string,
  reason: string,
  performedBy: string = 'admin',
) {
  return prisma.triageAuditLog.create({
    data: {
      visitRequestId,
      action,
      field,
      previousValue,
      newValue,
      reason,
      performedBy,
    },
  });
}

export const overrideService = {
  /**
   * Override urgency level with audit trail.
   */
  async overrideUrgency(input: OverrideUrgencyInput) {
    const vr = await prisma.visitRequest.findUnique({
      where: { id: input.visitRequestId },
    });
    if (!vr) throw new Error('Visit request not found');

    const previousValue = vr.urgencyLevel;
    const updated = await prisma.visitRequest.update({
      where: { id: input.visitRequestId },
      data: { urgencyLevel: input.urgencyLevel },
    });

    await createAuditLog(
      input.visitRequestId,
      'OVERRIDE_URGENCY',
      'urgencyLevel',
      previousValue,
      input.urgencyLevel,
      input.reason,
      input.performedBy,
    );

    return updated;
  },

  /**
   * Override request type with audit trail.
   */
  async overrideRequestType(input: OverrideRequestTypeInput) {
    const vr = await prisma.visitRequest.findUnique({
      where: { id: input.visitRequestId },
    });
    if (!vr) throw new Error('Visit request not found');

    const updated = await prisma.visitRequest.update({
      where: { id: input.visitRequestId },
      data: { requestType: input.requestType },
    });

    await createAuditLog(
      input.visitRequestId,
      'OVERRIDE_REQUEST_TYPE',
      'requestType',
      vr.requestType,
      input.requestType,
      input.reason,
      input.performedBy,
    );

    return updated;
  },

  /**
   * Override planning status with validated transition and audit trail.
   */
  async overridePlanningStatus(input: OverridePlanningStatusInput) {
    const vr = await prisma.visitRequest.findUnique({
      where: { id: input.visitRequestId },
    });
    if (!vr) throw new Error('Visit request not found');

    // Validate transition
    const validation = validatePlanningTransition(vr.planningStatus, input.planningStatus);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const updated = await prisma.visitRequest.update({
      where: { id: input.visitRequestId },
      data: { planningStatus: input.planningStatus },
    });

    await createAuditLog(
      input.visitRequestId,
      'OVERRIDE_PLANNING_STATUS',
      'planningStatus',
      vr.planningStatus,
      input.planningStatus,
      input.reason,
      input.performedBy,
    );

    // If moving to PLANNING_POOL, also clear needsMoreInfo
    if (input.planningStatus === 'PLANNING_POOL') {
      await prisma.visitRequest.update({
        where: { id: input.visitRequestId },
        data: { needsMoreInfo: false },
      });
    }

    return updated;
  },

  /**
   * Force to planning pool (skip missing info).
   */
  async forceToPool(input: OverrideInput) {
    const vr = await prisma.visitRequest.findUnique({
      where: { id: input.visitRequestId },
    });
    if (!vr) throw new Error('Visit request not found');

    const updated = await prisma.visitRequest.update({
      where: { id: input.visitRequestId },
      data: {
        planningStatus: 'PLANNING_POOL',
        needsMoreInfo: false,
      },
    });

    // Close open triage tasks
    await prisma.triageTask.updateMany({
      where: {
        visitRequestId: input.visitRequestId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      data: {
        status: 'DONE',
        notes: 'Auto-closed: forced to planning pool',
      },
    });

    // Update enquiry status if applicable
    if (vr.enquiryId) {
      await prisma.enquiry.update({
        where: { id: vr.enquiryId },
        data: { triageStatus: 'TRIAGED' },
      });
    }

    await createAuditLog(
      input.visitRequestId,
      'FORCE_TO_POOL',
      'planningStatus',
      vr.planningStatus,
      'PLANNING_POOL',
      input.reason,
      input.performedBy,
    );

    return updated;
  },

  /**
   * Force to urgent review.
   */
  async forceToUrgentReview(input: OverrideInput) {
    const vr = await prisma.visitRequest.findUnique({
      where: { id: input.visitRequestId },
    });
    if (!vr) throw new Error('Visit request not found');

    const updated = await prisma.visitRequest.update({
      where: { id: input.visitRequestId },
      data: {
        planningStatus: 'READY_FOR_REVIEW',
        urgencyLevel: 'URGENT',
      },
    });

    // Create urgent review task
    await prisma.triageTask.create({
      data: {
        visitRequestId: input.visitRequestId,
        taskType: 'URGENT_REVIEW',
        status: 'OPEN',
        notes: `Manually escalated: ${input.reason}`,
      },
    });

    await createAuditLog(
      input.visitRequestId,
      'FORCE_URGENT_REVIEW',
      'planningStatus',
      vr.planningStatus,
      'READY_FOR_REVIEW',
      input.reason,
      input.performedBy,
    );

    return updated;
  },

  /**
   * Add a clinical note to the visit request.
   */
  async addClinicalNote(input: OverrideInput & { note: string }) {
    const vr = await prisma.visitRequest.findUnique({
      where: { id: input.visitRequestId },
    });
    if (!vr) throw new Error('Visit request not found');

    const currentFlags = vr.clinicalFlags || [];
    const updated = await prisma.visitRequest.update({
      where: { id: input.visitRequestId },
      data: {
        clinicalFlags: [...currentFlags, input.note],
      },
    });

    await createAuditLog(
      input.visitRequestId,
      'ADD_CLINICAL_NOTE',
      'clinicalFlags',
      JSON.stringify(currentFlags),
      JSON.stringify([...currentFlags, input.note]),
      input.reason,
      input.performedBy,
    );

    return updated;
  },

  /**
   * Get audit history for a visit request.
   */
  async getAuditHistory(visitRequestId: string) {
    return prisma.triageAuditLog.findMany({
      where: { visitRequestId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
