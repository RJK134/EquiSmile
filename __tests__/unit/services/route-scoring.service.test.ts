import { describe, it, expect } from 'vitest';
import { scoreRoute, type RouteScoreInput } from '@/lib/services/route-scoring.service';

function makeInput(overrides: Partial<RouteScoreInput> = {}): RouteScoreInput {
  return {
    horseCount: 6,
    jobs: 3,
    travelMinutes: 60,
    gaps: 0,
    stops: [
      { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 75 },
      { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 75 },
      { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 75 },
    ],
    totalWorkMinutes: 285,
    ...overrides,
  };
}

describe('scoreRoute', () => {
  it('calculates base score correctly', () => {
    const result = scoreRoute(makeInput());
    // horseCount(6*10=60) + jobs(3*5=15) - travel(60*0.7=42) - gaps(0) + priority(0) + multiHorse(3*5=15) + avail(0) - util(0)
    expect(result.score).toBe(48);
    expect(result.breakdown.horseCountScore).toBe(60);
    expect(result.breakdown.jobsScore).toBe(15);
    expect(result.breakdown.travelPenalty).toBe(42);
    expect(result.breakdown.gapsPenalty).toBe(0);
    expect(result.breakdown.priorityWeight).toBe(0);
    expect(result.breakdown.multiHorseBonus).toBe(15);
  });

  it('is deterministic — same input always produces same output', () => {
    const input = makeInput();
    const result1 = scoreRoute(input);
    const result2 = scoreRoute(input);
    expect(result1.score).toBe(result2.score);
    expect(result1.breakdown).toEqual(result2.breakdown);
  });

  it('applies travel time penalty', () => {
    const short = scoreRoute(makeInput({ travelMinutes: 30 }));
    const long = scoreRoute(makeInput({ travelMinutes: 120 }));
    expect(short.score).toBeGreaterThan(long.score);
  });

  it('applies gaps penalty', () => {
    const noGaps = scoreRoute(makeInput({ gaps: 0 }));
    const twoGaps = scoreRoute(makeInput({ gaps: 2 }));
    expect(noGaps.score).toBeGreaterThan(twoGaps.score);
    expect(noGaps.score - twoGaps.score).toBe(16); // 2 * 8
  });

  it('applies priority weight for urgent stops', () => {
    const urgent = scoreRoute(makeInput({
      stops: [
        { horseCount: 2, urgencyLevel: 'URGENT', preferredDays: [], serviceMinutes: 75 },
        { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 75 },
        { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 75 },
      ],
    }));
    const routine = scoreRoute(makeInput());
    expect(urgent.score).toBeGreaterThan(routine.score);
    expect(urgent.breakdown.priorityWeight).toBe(50);
  });

  it('applies priority weight for soon stops', () => {
    const result = scoreRoute(makeInput({
      stops: [
        { horseCount: 2, urgencyLevel: 'SOON', preferredDays: [], serviceMinutes: 75 },
        { horseCount: 2, urgencyLevel: 'SOON', preferredDays: [], serviceMinutes: 75 },
        { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 75 },
      ],
    }));
    expect(result.breakdown.priorityWeight).toBe(40); // 20 + 20 + 0
  });

  it('applies multi-horse bonus for yards with 2+ horses', () => {
    const multiHorse = scoreRoute(makeInput({
      stops: [
        { horseCount: 3, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 75 },
        { horseCount: 1, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 45 },
        { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 75 },
      ],
    }));
    expect(multiHorse.breakdown.multiHorseBonus).toBe(10); // 2 yards with 2+ horses
  });

  it('applies availability bonus when all stops match scheduled day', () => {
    const result = scoreRoute(makeInput({
      scheduledDay: 'mon',
      stops: [
        { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: ['mon', 'tue'], serviceMinutes: 75 },
        { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: ['mon'], serviceMinutes: 75 },
        { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 75 },
      ],
    }));
    expect(result.breakdown.availabilityBonus).toBe(10);
  });

  it('does not apply availability bonus when not all stops match', () => {
    const result = scoreRoute(makeInput({
      scheduledDay: 'mon',
      stops: [
        { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: ['mon'], serviceMinutes: 75 },
        { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: ['tue', 'wed'], serviceMinutes: 75 },
        { horseCount: 2, urgencyLevel: 'ROUTINE', preferredDays: [], serviceMinutes: 75 },
      ],
    }));
    expect(result.breakdown.availabilityBonus).toBe(0);
  });

  it('penalises under-utilisation (< 4 hours)', () => {
    const result = scoreRoute(makeInput({ totalWorkMinutes: 180 }));
    expect(result.breakdown.utilisationPenalty).toBe(15);
  });

  it('penalises over-utilisation (> 8 hours)', () => {
    const result = scoreRoute(makeInput({ totalWorkMinutes: 540 }));
    expect(result.breakdown.utilisationPenalty).toBe(15);
  });

  it('no utilisation penalty for normal workday (4-8 hours)', () => {
    const result = scoreRoute(makeInput({ totalWorkMinutes: 360 }));
    expect(result.breakdown.utilisationPenalty).toBe(0);
  });

  it('handles edge case: zero horses', () => {
    const result = scoreRoute(makeInput({
      horseCount: 0,
      stops: [],
      jobs: 0,
      travelMinutes: 0,
      gaps: 0,
      totalWorkMinutes: 0,
    }));
    expect(result.score).toBe(-15); // Only utilisation penalty
  });

  it('handles edge case: single high-value stop', () => {
    const result = scoreRoute(makeInput({
      horseCount: 5,
      jobs: 1,
      travelMinutes: 10,
      gaps: 0,
      stops: [
        { horseCount: 5, urgencyLevel: 'URGENT', preferredDays: [], serviceMinutes: 165 },
      ],
      totalWorkMinutes: 175,
    }));
    expect(result.breakdown.horseCountScore).toBe(50);
    expect(result.breakdown.priorityWeight).toBe(50);
    expect(result.breakdown.multiHorseBonus).toBe(5);
  });
});
