/**
 * Phase 12a — Working Day Hard Constraints
 *
 * Configurable limits for route planning. These are hard constraints that
 * cause route proposals to be REJECTED (not just penalised) when exceeded.
 *
 * Working hours:  08:30–17:30 (540 minutes)
 * Max travel:     3 hours (180 minutes) per day
 * Max yards:      6 per day
 * Max horses:     10 per day
 */

// ---------------------------------------------------------------------------
// Hard constraint constants
// ---------------------------------------------------------------------------

export const ROUTE_HARD_CONSTRAINTS = {
  /** Workday start hour (24h format) */
  workdayStartHour: 8,
  /** Workday start minute */
  workdayStartMinute: 30,
  /** Workday end hour (24h format) */
  workdayEndHour: 17,
  /** Workday end minute */
  workdayEndMinute: 30,
  /** Maximum travel time per day in minutes */
  maxTravelMinutesPerDay: 180,
  /** Maximum number of yard stops per day */
  maxYardsPerDay: 6,
  /** Maximum number of horses per day */
  maxHorsesPerDay: 10,
} as const;

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

/** Total available working minutes in a day (08:30–17:30 = 540 min) */
export const WORKDAY_MINUTES =
  (ROUTE_HARD_CONSTRAINTS.workdayEndHour * 60 + ROUTE_HARD_CONSTRAINTS.workdayEndMinute) -
  (ROUTE_HARD_CONSTRAINTS.workdayStartHour * 60 + ROUTE_HARD_CONSTRAINTS.workdayStartMinute);

// ---------------------------------------------------------------------------
// Planning parameters (soft / tuneable)
// ---------------------------------------------------------------------------

export const ROUTE_PLANNING_PARAMS = {
  /** Standard service time per horse in minutes */
  standardServiceMinutesPerHorse: 30,
  /** Buffer time per stop in minutes (setup/teardown) */
  bufferMinutesPerStop: 15,
  /** Preferred maximum inter-stop travel time in minutes */
  preferredMaxInterStopMinutes: 25,
  /** Minimum density score for a cluster to be viable */
  minDensityScoreThreshold: 20,
} as const;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export interface ConstraintViolation {
  constraint: string;
  limit: number;
  actual: number;
  message: string;
}

/**
 * Validate a route proposal against hard constraints.
 * Returns an array of violations (empty = valid).
 */
export function validateRouteConstraints(params: {
  totalTravelMinutes: number;
  stopCount: number;
  totalHorses: number;
  totalWorkMinutes?: number;
}): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  if (params.totalTravelMinutes > ROUTE_HARD_CONSTRAINTS.maxTravelMinutesPerDay) {
    violations.push({
      constraint: 'maxTravelMinutesPerDay',
      limit: ROUTE_HARD_CONSTRAINTS.maxTravelMinutesPerDay,
      actual: params.totalTravelMinutes,
      message: `Travel time ${params.totalTravelMinutes} min exceeds maximum ${ROUTE_HARD_CONSTRAINTS.maxTravelMinutesPerDay} min per day`,
    });
  }

  if (params.stopCount > ROUTE_HARD_CONSTRAINTS.maxYardsPerDay) {
    violations.push({
      constraint: 'maxYardsPerDay',
      limit: ROUTE_HARD_CONSTRAINTS.maxYardsPerDay,
      actual: params.stopCount,
      message: `Stop count ${params.stopCount} exceeds maximum ${ROUTE_HARD_CONSTRAINTS.maxYardsPerDay} yards per day`,
    });
  }

  if (params.totalHorses > ROUTE_HARD_CONSTRAINTS.maxHorsesPerDay) {
    violations.push({
      constraint: 'maxHorsesPerDay',
      limit: ROUTE_HARD_CONSTRAINTS.maxHorsesPerDay,
      actual: params.totalHorses,
      message: `Horse count ${params.totalHorses} exceeds maximum ${ROUTE_HARD_CONSTRAINTS.maxHorsesPerDay} per day`,
    });
  }

  if (params.totalWorkMinutes !== undefined && params.totalWorkMinutes > WORKDAY_MINUTES) {
    violations.push({
      constraint: 'workdayCapacity',
      limit: WORKDAY_MINUTES,
      actual: params.totalWorkMinutes,
      message: `Total work ${params.totalWorkMinutes} min exceeds working day capacity ${WORKDAY_MINUTES} min (08:30–17:30)`,
    });
  }

  return violations;
}
