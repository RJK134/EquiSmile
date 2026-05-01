/**
 * Map a triage task type enum value to its translation key under the
 * `triage` namespace. Returns the raw enum value as a fallback so that
 * unknown task types remain visible rather than silently disappearing.
 */
export function taskTypeLabel(taskType: string): string {
  const map: Record<string, string> = {
    URGENT_REVIEW: 'urgentReview',
    ASK_FOR_POSTCODE: 'askPostcode',
    ASK_HORSE_COUNT: 'askHorseCount',
    CLARIFY_SYMPTOMS: 'clarifySymptoms',
    MANUAL_CLASSIFICATION: 'manualClassification',
  };
  return map[taskType] ?? taskType;
}
