/**
 * Phase 4 — Status Machine with Validated Transitions
 *
 * Enforces strict status flows for Enquiry, VisitRequest, and TriageTask.
 * Rejects invalid transitions with descriptive errors.
 */

import type { TriageStatus, PlanningStatus, TriageTaskStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Transition maps
// ---------------------------------------------------------------------------

const ENQUIRY_TRANSITIONS: Record<TriageStatus, TriageStatus[]> = {
  NEW: ['PARSED', 'NEEDS_INFO', 'TRIAGED'],
  PARSED: ['NEEDS_INFO', 'TRIAGED'],
  NEEDS_INFO: ['TRIAGED', 'PARSED'],
  TRIAGED: [],
};

const PLANNING_TRANSITIONS: Record<PlanningStatus, PlanningStatus[]> = {
  UNTRIAGED: ['READY_FOR_REVIEW', 'PLANNING_POOL', 'CANCELLED'],
  READY_FOR_REVIEW: ['PLANNING_POOL', 'CANCELLED'],
  PLANNING_POOL: ['CLUSTERED', 'CANCELLED'],
  CLUSTERED: ['PROPOSED', 'CANCELLED', 'PLANNING_POOL'],
  PROPOSED: ['BOOKED', 'CANCELLED', 'PLANNING_POOL'],
  BOOKED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const TRIAGE_TASK_TRANSITIONS: Record<TriageTaskStatus, TriageTaskStatus[]> = {
  OPEN: ['IN_PROGRESS', 'DONE'],
  IN_PROGRESS: ['DONE'],
  DONE: [],
};

// ---------------------------------------------------------------------------
// Transition log entry
// ---------------------------------------------------------------------------

export interface StatusTransitionLog {
  entity: 'enquiry' | 'visitRequest' | 'triageTask';
  entityId: string;
  from: string;
  to: string;
  reason?: string;
  triggeredBy?: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateEnquiryTransition(
  current: TriageStatus,
  target: TriageStatus,
): { valid: boolean; error?: string } {
  if (current === target) {
    return { valid: true };
  }

  const allowed = ENQUIRY_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    return {
      valid: false,
      error: `Invalid enquiry status transition: ${current} → ${target}. Allowed: ${allowed?.join(', ') || 'none'}`,
    };
  }

  return { valid: true };
}

export function validatePlanningTransition(
  current: PlanningStatus,
  target: PlanningStatus,
): { valid: boolean; error?: string } {
  if (current === target) {
    return { valid: true };
  }

  const allowed = PLANNING_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    return {
      valid: false,
      error: `Invalid planning status transition: ${current} → ${target}. Allowed: ${allowed?.join(', ') || 'none'}`,
    };
  }

  return { valid: true };
}

export function validateTriageTaskTransition(
  current: TriageTaskStatus,
  target: TriageTaskStatus,
): { valid: boolean; error?: string } {
  if (current === target) {
    return { valid: true };
  }

  const allowed = TRIAGE_TASK_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    return {
      valid: false,
      error: `Invalid triage task status transition: ${current} → ${target}. Allowed: ${allowed?.join(', ') || 'none'}`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Transition log builder
// ---------------------------------------------------------------------------

export function buildTransitionLog(
  entity: StatusTransitionLog['entity'],
  entityId: string,
  from: string,
  to: string,
  reason?: string,
  triggeredBy?: string,
): StatusTransitionLog {
  return {
    entity,
    entityId,
    from,
    to,
    reason,
    triggeredBy,
    timestamp: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Status machine service
// ---------------------------------------------------------------------------

export const statusMachineService = {
  validateEnquiryTransition,
  validatePlanningTransition,
  validateTriageTaskTransition,
  buildTransitionLog,

  /**
   * Get the list of valid next statuses for a planning status.
   */
  getValidPlanningTransitions(current: PlanningStatus): PlanningStatus[] {
    return PLANNING_TRANSITIONS[current] ?? [];
  },

  /**
   * Get the list of valid next statuses for an enquiry triage status.
   */
  getValidEnquiryTransitions(current: TriageStatus): TriageStatus[] {
    return ENQUIRY_TRANSITIONS[current] ?? [];
  },

  /**
   * Get the list of valid next statuses for a triage task status.
   */
  getValidTriageTaskTransitions(current: TriageTaskStatus): TriageTaskStatus[] {
    return TRIAGE_TASK_TRANSITIONS[current] ?? [];
  },
};
