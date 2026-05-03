/**
 * Phase 4 — Auto-Triage Integration
 *
 * Runs the triage rules engine on new enquiries and applies results
 * to visit requests, creating triage tasks as needed.
 */

import { prisma } from '@/lib/prisma';
import { runTriageRules, type TriageInput } from './triage-rules.service';
import { parseMessage } from '@/lib/utils/message-parser';
import { logger } from '@/lib/utils/logger';

export interface AutoTriageResult {
  visitRequestId: string;
  urgency: string;
  requestType: string;
  planningStatus: string;
  needsMoreInfo: boolean;
  confidence: number;
  tasksCreated: string[];
}

export const autoTriageService = {
  /**
   * Run auto-triage on a newly created enquiry + visit request.
   * Called from webhook handlers and manual enquiry creation.
   */
  async triageEnquiry(
    enquiryId: string,
    visitRequestId: string,
    messageText: string,
  ): Promise<AutoTriageResult> {
    // Fetch visit request with related data
    const vr = await prisma.visitRequest.findUnique({
      where: { id: visitRequestId },
      include: {
        yard: { select: { postcode: true } },
        customer: { select: { preferredLanguage: true } },
      },
    });

    if (!vr) throw new Error('Visit request not found');

    // Parse raw message for structured info
    const parsed = parseMessage(messageText);

    // Build triage input
    const input: TriageInput = {
      messageText,
      horseCount: vr.horseCount ?? parsed.horseCount,
      hasPostcode: !!(vr.yard?.postcode || parsed.postcodes.length > 0),
      hasYard: !!vr.yardId,
      hasPreferredDays: vr.preferredDays.length > 0,
    };

    // Run rules engine
    const result = runTriageRules(input);

    // Determine planning status. DEMO-04 — when the inbound message
    // arrives complete (yard matched, horse count present, no urgent
    // keywords), promote straight to PLANNING_POOL so the visit
    // never sits in the operator's triage queue. Pulled out as
    // explicit branches so the audit log can announce the path
    // taken.
    let planningStatus: string;
    if (result.urgency === 'URGENT') {
      planningStatus = 'READY_FOR_REVIEW';
    } else if (result.needsMoreInfo) {
      planningStatus = 'UNTRIAGED';
    } else {
      planningStatus = 'PLANNING_POOL';
      logger.info('Auto-promoted visit request to planning pool', {
        service: 'auto-triage-service',
        operation: 'auto-promote',
        visitRequestId,
        enquiryId,
        confidence: result.confidence,
      });
    }

    // Determine enquiry triage status
    const triageStatus = result.needsMoreInfo ? 'NEEDS_INFO' : 'TRIAGED';

    // Update visit request
    await prisma.visitRequest.update({
      where: { id: visitRequestId },
      data: {
        urgencyLevel: result.urgency,
        requestType: result.requestType,
        clinicalFlags: result.clinicalFlags,
        needsMoreInfo: result.needsMoreInfo,
        planningStatus: planningStatus as 'UNTRIAGED' | 'READY_FOR_REVIEW' | 'PLANNING_POOL',
        estimatedDurationMinutes: result.estimatedDuration,
        autoTriageConfidence: result.confidence,
        horseCount: vr.horseCount ?? parsed.horseCount,
      },
    });

    // Update enquiry status
    await prisma.enquiry.update({
      where: { id: enquiryId },
      data: {
        triageStatus: triageStatus as 'NEEDS_INFO' | 'TRIAGED',
      },
    });

    // Create triage tasks
    const tasksCreated: string[] = [];

    // Urgent → always create URGENT_REVIEW task
    if (result.urgency === 'URGENT') {
      const task = await prisma.triageTask.create({
        data: {
          visitRequestId,
          taskType: 'URGENT_REVIEW',
          status: 'OPEN',
          notes: `Auto-triaged as urgent. Clinical flags: ${result.clinicalFlags.join(', ')}`,
        },
      });
      tasksCreated.push(task.id);
    }

    // Create tasks for missing fields
    for (const missing of result.missingFields) {
      const task = await prisma.triageTask.create({
        data: {
          visitRequestId,
          taskType: missing.taskType,
          status: 'OPEN',
          notes: `Auto-detected: missing ${missing.field}`,
        },
      });
      tasksCreated.push(task.id);
    }

    return {
      visitRequestId,
      urgency: result.urgency,
      requestType: result.requestType,
      planningStatus,
      needsMoreInfo: result.needsMoreInfo,
      confidence: result.confidence,
      tasksCreated,
    };
  },
};
