import { TriageTaskType } from '@prisma/client';

/**
 * Maps each TriageTaskType enum value to its i18n key in the 'triage' namespace.
 * Defined at module scope to avoid re-allocation on every render/call.
 */
export const TRIAGE_TASK_TYPE_LABEL_MAP: Record<TriageTaskType, string> = {
  [TriageTaskType.URGENT_REVIEW]: 'urgentReview',
  [TriageTaskType.ASK_FOR_POSTCODE]: 'askPostcode',
  [TriageTaskType.ASK_HORSE_COUNT]: 'askHorseCount',
  [TriageTaskType.CLARIFY_SYMPTOMS]: 'clarifySymptoms',
  [TriageTaskType.MANUAL_CLASSIFICATION]: 'manualClassification',
};

/**
 * Returns the i18n key for a given TriageTaskType value.
 * Falls back to the raw value if the map ever drifts (e.g. during migrations).
 */
export function taskTypeLabel(taskType: string): string {
  return TRIAGE_TASK_TYPE_LABEL_MAP[taskType as TriageTaskType] ?? taskType;
}
