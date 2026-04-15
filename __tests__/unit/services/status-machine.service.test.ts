import { describe, it, expect } from 'vitest';
import {
  validateEnquiryTransition,
  validatePlanningTransition,
  validateTriageTaskTransition,
  statusMachineService,
} from '@/lib/services/status-machine.service';

describe('status-machine.service', () => {
  // -----------------------------------------------------------------------
  // Enquiry transitions
  // -----------------------------------------------------------------------
  describe('validateEnquiryTransition', () => {
    it('allows NEW → PARSED', () => {
      expect(validateEnquiryTransition('NEW', 'PARSED').valid).toBe(true);
    });

    it('allows NEW → NEEDS_INFO', () => {
      expect(validateEnquiryTransition('NEW', 'NEEDS_INFO').valid).toBe(true);
    });

    it('allows NEW → TRIAGED', () => {
      expect(validateEnquiryTransition('NEW', 'TRIAGED').valid).toBe(true);
    });

    it('allows PARSED → NEEDS_INFO', () => {
      expect(validateEnquiryTransition('PARSED', 'NEEDS_INFO').valid).toBe(true);
    });

    it('allows PARSED → TRIAGED', () => {
      expect(validateEnquiryTransition('PARSED', 'TRIAGED').valid).toBe(true);
    });

    it('allows NEEDS_INFO → TRIAGED', () => {
      expect(validateEnquiryTransition('NEEDS_INFO', 'TRIAGED').valid).toBe(true);
    });

    it('rejects TRIAGED → NEW', () => {
      const result = validateEnquiryTransition('TRIAGED', 'NEW');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid enquiry status transition');
    });

    it('rejects TRIAGED → PARSED', () => {
      expect(validateEnquiryTransition('TRIAGED', 'PARSED').valid).toBe(false);
    });

    it('allows same-state transition', () => {
      expect(validateEnquiryTransition('NEW', 'NEW').valid).toBe(true);
      expect(validateEnquiryTransition('TRIAGED', 'TRIAGED').valid).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Planning status transitions
  // -----------------------------------------------------------------------
  describe('validatePlanningTransition', () => {
    it('allows UNTRIAGED → READY_FOR_REVIEW', () => {
      expect(validatePlanningTransition('UNTRIAGED', 'READY_FOR_REVIEW').valid).toBe(true);
    });

    it('allows UNTRIAGED → PLANNING_POOL', () => {
      expect(validatePlanningTransition('UNTRIAGED', 'PLANNING_POOL').valid).toBe(true);
    });

    it('allows READY_FOR_REVIEW → PLANNING_POOL', () => {
      expect(validatePlanningTransition('READY_FOR_REVIEW', 'PLANNING_POOL').valid).toBe(true);
    });

    it('allows PLANNING_POOL → CLUSTERED', () => {
      expect(validatePlanningTransition('PLANNING_POOL', 'CLUSTERED').valid).toBe(true);
    });

    it('allows any → CANCELLED', () => {
      expect(validatePlanningTransition('UNTRIAGED', 'CANCELLED').valid).toBe(true);
      expect(validatePlanningTransition('READY_FOR_REVIEW', 'CANCELLED').valid).toBe(true);
      expect(validatePlanningTransition('PLANNING_POOL', 'CANCELLED').valid).toBe(true);
      expect(validatePlanningTransition('BOOKED', 'CANCELLED').valid).toBe(true);
    });

    it('rejects PLANNING_POOL → UNTRIAGED', () => {
      const result = validatePlanningTransition('PLANNING_POOL', 'UNTRIAGED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid planning status transition');
    });

    it('rejects COMPLETED → any', () => {
      expect(validatePlanningTransition('COMPLETED', 'PLANNING_POOL').valid).toBe(false);
      expect(validatePlanningTransition('COMPLETED', 'UNTRIAGED').valid).toBe(false);
    });

    it('rejects CANCELLED → any', () => {
      expect(validatePlanningTransition('CANCELLED', 'PLANNING_POOL').valid).toBe(false);
    });

    it('allows BOOKED → COMPLETED', () => {
      expect(validatePlanningTransition('BOOKED', 'COMPLETED').valid).toBe(true);
    });

    it('allows same-state transition', () => {
      expect(validatePlanningTransition('UNTRIAGED', 'UNTRIAGED').valid).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Triage task status transitions
  // -----------------------------------------------------------------------
  describe('validateTriageTaskTransition', () => {
    it('allows OPEN → IN_PROGRESS', () => {
      expect(validateTriageTaskTransition('OPEN', 'IN_PROGRESS').valid).toBe(true);
    });

    it('allows OPEN → DONE (direct close)', () => {
      expect(validateTriageTaskTransition('OPEN', 'DONE').valid).toBe(true);
    });

    it('allows IN_PROGRESS → DONE', () => {
      expect(validateTriageTaskTransition('IN_PROGRESS', 'DONE').valid).toBe(true);
    });

    it('rejects DONE → OPEN', () => {
      expect(validateTriageTaskTransition('DONE', 'OPEN').valid).toBe(false);
    });

    it('rejects DONE → IN_PROGRESS', () => {
      expect(validateTriageTaskTransition('DONE', 'IN_PROGRESS').valid).toBe(false);
    });

    it('rejects IN_PROGRESS → OPEN', () => {
      expect(validateTriageTaskTransition('IN_PROGRESS', 'OPEN').valid).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Service methods
  // -----------------------------------------------------------------------
  describe('statusMachineService', () => {
    it('getValidPlanningTransitions returns correct options', () => {
      expect(statusMachineService.getValidPlanningTransitions('UNTRIAGED')).toContain('READY_FOR_REVIEW');
      expect(statusMachineService.getValidPlanningTransitions('UNTRIAGED')).toContain('PLANNING_POOL');
      expect(statusMachineService.getValidPlanningTransitions('COMPLETED')).toHaveLength(0);
    });

    it('getValidEnquiryTransitions returns correct options', () => {
      expect(statusMachineService.getValidEnquiryTransitions('NEW')).toContain('PARSED');
      expect(statusMachineService.getValidEnquiryTransitions('TRIAGED')).toHaveLength(0);
    });

    it('getValidTriageTaskTransitions returns correct options', () => {
      expect(statusMachineService.getValidTriageTaskTransitions('OPEN')).toContain('IN_PROGRESS');
      expect(statusMachineService.getValidTriageTaskTransitions('OPEN')).toContain('DONE');
      expect(statusMachineService.getValidTriageTaskTransitions('DONE')).toHaveLength(0);
    });
  });
});
