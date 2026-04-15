/**
 * Phase 5 — Route Scoring Algorithm
 *
 * Pure, deterministic scoring function for route proposals.
 *
 * Formula:
 *   score = (horseCount × 10) + (jobs × 5) - (travelMinutes × 0.7) - (gaps × 8) + priorityWeight
 *
 * Additional factors:
 *   - Multi-horse yards bonus: +5 per yard with 2+ horses
 *   - Availability match: +10 if all stops match preferred day
 *   - Day utilisation penalty: penalise if total work < 4h or > 8h
 */

export interface RouteScoreInput {
  horseCount: number;
  jobs: number;
  travelMinutes: number;
  gaps: number;
  stops: Array<{
    horseCount: number;
    urgencyLevel: 'URGENT' | 'SOON' | 'ROUTINE';
    preferredDays: string[];
    serviceMinutes: number;
  }>;
  scheduledDay?: string;
  totalWorkMinutes: number;
}

export interface RouteScoreResult {
  score: number;
  breakdown: {
    horseCountScore: number;
    jobsScore: number;
    travelPenalty: number;
    gapsPenalty: number;
    priorityWeight: number;
    multiHorseBonus: number;
    availabilityBonus: number;
    utilisationPenalty: number;
  };
}

const WEIGHTS = {
  horseCount: 10,
  jobs: 5,
  travelMinutes: 0.7,
  gaps: 8,
  priority: { URGENT: 50, SOON: 20, ROUTINE: 0 },
  multiHorseBonus: 5,
  availabilityBonus: 10,
  underUtilMinutes: 240, // 4 hours
  overUtilMinutes: 480,  // 8 hours
  utilisationPenalty: 15,
} as const;

/**
 * Calculate the priority weight from all stops.
 */
function calculatePriorityWeight(
  stops: Array<{ urgencyLevel: 'URGENT' | 'SOON' | 'ROUTINE' }>,
): number {
  return stops.reduce((sum, stop) => sum + WEIGHTS.priority[stop.urgencyLevel], 0);
}

/**
 * Calculate multi-horse yard bonus.
 */
function calculateMultiHorseBonus(
  stops: Array<{ horseCount: number }>,
): number {
  return stops.filter((s) => s.horseCount >= 2).length * WEIGHTS.multiHorseBonus;
}

/**
 * Calculate availability match bonus.
 * +10 if all stops match the scheduled day.
 */
function calculateAvailabilityBonus(
  stops: Array<{ preferredDays: string[] }>,
  scheduledDay?: string,
): number {
  if (!scheduledDay) return 0;
  const allMatch = stops.every(
    (s) => s.preferredDays.length === 0 || s.preferredDays.includes(scheduledDay),
  );
  return allMatch ? WEIGHTS.availabilityBonus : 0;
}

/**
 * Calculate day utilisation penalty.
 */
function calculateUtilisationPenalty(totalWorkMinutes: number): number {
  if (totalWorkMinutes < WEIGHTS.underUtilMinutes) {
    return WEIGHTS.utilisationPenalty;
  }
  if (totalWorkMinutes > WEIGHTS.overUtilMinutes) {
    return WEIGHTS.utilisationPenalty;
  }
  return 0;
}

/**
 * Score a route proposal. Pure and deterministic.
 */
export function scoreRoute(input: RouteScoreInput): RouteScoreResult {
  const horseCountScore = input.horseCount * WEIGHTS.horseCount;
  const jobsScore = input.jobs * WEIGHTS.jobs;
  const travelPenalty = input.travelMinutes * WEIGHTS.travelMinutes;
  const gapsPenalty = input.gaps * WEIGHTS.gaps;
  const priorityWeight = calculatePriorityWeight(input.stops);
  const multiHorseBonus = calculateMultiHorseBonus(input.stops);
  const availabilityBonus = calculateAvailabilityBonus(input.stops, input.scheduledDay);
  const utilisationPenalty = calculateUtilisationPenalty(input.totalWorkMinutes);

  const score =
    horseCountScore +
    jobsScore -
    travelPenalty -
    gapsPenalty +
    priorityWeight +
    multiHorseBonus +
    availabilityBonus -
    utilisationPenalty;

  return {
    score: Math.round(score * 100) / 100,
    breakdown: {
      horseCountScore,
      jobsScore,
      travelPenalty: Math.round(travelPenalty * 100) / 100,
      gapsPenalty,
      priorityWeight,
      multiHorseBonus,
      availabilityBonus,
      utilisationPenalty,
    },
  };
}

export const routeScoringService = {
  scoreRoute,
};
