import { describe, it, expect } from 'vitest';
import {
  ROUTE_HARD_CONSTRAINTS,
  ROUTE_PLANNING_PARAMS,
  WORKDAY_MINUTES,
  validateRouteConstraints,
} from '@/lib/config/route-constraints';

describe('route-constraints config', () => {
  describe('ROUTE_HARD_CONSTRAINTS', () => {
    it('defines working hours as 08:30–17:30', () => {
      expect(ROUTE_HARD_CONSTRAINTS.workdayStartHour).toBe(8);
      expect(ROUTE_HARD_CONSTRAINTS.workdayStartMinute).toBe(30);
      expect(ROUTE_HARD_CONSTRAINTS.workdayEndHour).toBe(17);
      expect(ROUTE_HARD_CONSTRAINTS.workdayEndMinute).toBe(30);
    });

    it('sets max travel time to 180 minutes (3 hours)', () => {
      expect(ROUTE_HARD_CONSTRAINTS.maxTravelMinutesPerDay).toBe(180);
    });

    it('sets max yards per day to 6', () => {
      expect(ROUTE_HARD_CONSTRAINTS.maxYardsPerDay).toBe(6);
    });

    it('sets max horses per day to 10', () => {
      expect(ROUTE_HARD_CONSTRAINTS.maxHorsesPerDay).toBe(10);
    });
  });

  describe('WORKDAY_MINUTES', () => {
    it('calculates to 540 minutes (08:30–17:30)', () => {
      expect(WORKDAY_MINUTES).toBe(540);
    });
  });

  describe('ROUTE_PLANNING_PARAMS', () => {
    it('uses 30 minutes per horse as standard service time', () => {
      expect(ROUTE_PLANNING_PARAMS.standardServiceMinutesPerHorse).toBe(30);
    });

    it('uses 15 minutes buffer per stop', () => {
      expect(ROUTE_PLANNING_PARAMS.bufferMinutesPerStop).toBe(15);
    });
  });

  describe('validateRouteConstraints', () => {
    it('returns no violations for a valid route', () => {
      const violations = validateRouteConstraints({
        totalTravelMinutes: 120,
        stopCount: 4,
        totalHorses: 8,
        totalWorkMinutes: 400,
      });

      expect(violations).toHaveLength(0);
    });

    it('rejects when travel time exceeds 180 minutes', () => {
      const violations = validateRouteConstraints({
        totalTravelMinutes: 200,
        stopCount: 4,
        totalHorses: 8,
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].constraint).toBe('maxTravelMinutesPerDay');
      expect(violations[0].limit).toBe(180);
      expect(violations[0].actual).toBe(200);
    });

    it('rejects when stop count exceeds 6 yards', () => {
      const violations = validateRouteConstraints({
        totalTravelMinutes: 100,
        stopCount: 8,
        totalHorses: 8,
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].constraint).toBe('maxYardsPerDay');
      expect(violations[0].limit).toBe(6);
      expect(violations[0].actual).toBe(8);
    });

    it('rejects when horse count exceeds 10', () => {
      const violations = validateRouteConstraints({
        totalTravelMinutes: 100,
        stopCount: 5,
        totalHorses: 12,
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].constraint).toBe('maxHorsesPerDay');
      expect(violations[0].limit).toBe(10);
      expect(violations[0].actual).toBe(12);
    });

    it('rejects when total work exceeds workday capacity (540 min)', () => {
      const violations = validateRouteConstraints({
        totalTravelMinutes: 150,
        stopCount: 5,
        totalHorses: 8,
        totalWorkMinutes: 600,
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].constraint).toBe('workdayCapacity');
      expect(violations[0].limit).toBe(540);
      expect(violations[0].actual).toBe(600);
    });

    it('returns multiple violations when several constraints are breached', () => {
      const violations = validateRouteConstraints({
        totalTravelMinutes: 200,
        stopCount: 8,
        totalHorses: 15,
        totalWorkMinutes: 700,
      });

      expect(violations).toHaveLength(4);
      const constraintNames = violations.map((v) => v.constraint);
      expect(constraintNames).toContain('maxTravelMinutesPerDay');
      expect(constraintNames).toContain('maxYardsPerDay');
      expect(constraintNames).toContain('maxHorsesPerDay');
      expect(constraintNames).toContain('workdayCapacity');
    });

    it('skips workday check when totalWorkMinutes is not provided', () => {
      const violations = validateRouteConstraints({
        totalTravelMinutes: 100,
        stopCount: 4,
        totalHorses: 8,
      });

      expect(violations).toHaveLength(0);
    });

    it('passes at exact boundary values', () => {
      const violations = validateRouteConstraints({
        totalTravelMinutes: 180,
        stopCount: 6,
        totalHorses: 10,
        totalWorkMinutes: 540,
      });

      expect(violations).toHaveLength(0);
    });

    it('rejects at one above boundary values', () => {
      const violations = validateRouteConstraints({
        totalTravelMinutes: 181,
        stopCount: 7,
        totalHorses: 11,
        totalWorkMinutes: 541,
      });

      expect(violations).toHaveLength(4);
    });
  });
});
