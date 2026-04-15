/**
 * Phase 4 — Standardised Triage Rules Engine
 *
 * Deterministic, keyword-based classification of incoming messages.
 * Supports both English and French text. Pure functions, no side effects.
 */

import type { RequestType, UrgencyLevel, TriageTaskType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriageInput {
  messageText: string;
  horseCount?: number | null;
  hasPostcode?: boolean;
  hasYard?: boolean;
  hasPreferredDays?: boolean;
  isFirstVisit?: boolean;
  customerName?: string;
}

export interface TriageResult {
  urgency: UrgencyLevel;
  requestType: RequestType;
  clinicalFlags: string[];
  needsMoreInfo: boolean;
  missingFields: { field: string; taskType: TriageTaskType }[];
  estimatedDuration: number;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Keyword dictionaries (EN + FR)
// ---------------------------------------------------------------------------

const URGENT_KEYWORDS_EN = [
  'pain', "can't eat", 'unable to eat', 'not eating', 'swelling', 'swollen',
  'bleeding', 'blood', 'distress', 'emergency', 'acute', 'severe',
  'weight loss', "won't eat", 'quidding badly', 'lame jaw', 'abscess',
];

const URGENT_KEYWORDS_FR = [
  'douleur', 'ne mange pas', 'gonflement', 'saignement', 'sang',
  'urgence', 'détresse', 'perte de poids', 'abcès',
];

const SOON_KEYWORDS_EN = [
  'overdue', 'follow-up', 'follow up', 'mild symptoms', 'concerned',
  'worried', 'not right', 'behaving oddly', 'due for check',
];

const SOON_KEYWORDS_FR = [
  'en retard', 'suivi', 'inquiet', 'pas normal', 'contrôle prévu',
];

const ROUTINE_KEYWORDS_EN = [
  'check-up', 'checkup', 'routine', 'dental', 'annual', 'next in area',
  'when available', 'multiple horses due',
];

const ROUTINE_KEYWORDS_FR = [
  'contrôle', 'routine', 'dentaire', 'annuel', 'disponible',
];

// Request type keywords
const FOLLOW_UP_KEYWORDS = [
  'follow-up', 'follow up', 'recheck', 'after last visit', 'suivi', 'dernier visite',
];

const FIRST_VISIT_KEYWORDS = [
  'first time', 'new horse', 'never had', 'nouveau', 'première fois', 'premier',
];

const ADMIN_KEYWORDS = [
  'invoice', 'receipt', 'records', 'payment', 'facture', 'reçu', 'paiement', 'dossier',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesAny(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Classification functions
// ---------------------------------------------------------------------------

export function classifyUrgency(text: string): { urgency: UrgencyLevel; matchedKeywords: string[] } {
  const urgentMatchesEN = matchesAny(text, URGENT_KEYWORDS_EN);
  const urgentMatchesFR = matchesAny(text, URGENT_KEYWORDS_FR);
  const urgentMatches = [...urgentMatchesEN, ...urgentMatchesFR];

  if (urgentMatches.length > 0) {
    return { urgency: 'URGENT', matchedKeywords: urgentMatches };
  }

  const soonMatchesEN = matchesAny(text, SOON_KEYWORDS_EN);
  const soonMatchesFR = matchesAny(text, SOON_KEYWORDS_FR);
  const soonMatches = [...soonMatchesEN, ...soonMatchesFR];

  if (soonMatches.length > 0) {
    return { urgency: 'SOON', matchedKeywords: soonMatches };
  }

  // Check for routine keywords — if found, confidence is higher
  const routineMatchesEN = matchesAny(text, ROUTINE_KEYWORDS_EN);
  const routineMatchesFR = matchesAny(text, ROUTINE_KEYWORDS_FR);
  const routineMatches = [...routineMatchesEN, ...routineMatchesFR];

  return { urgency: 'ROUTINE', matchedKeywords: routineMatches };
}

export function classifyRequestType(text: string, urgency: UrgencyLevel): RequestType {
  if (urgency === 'URGENT') {
    return 'URGENT_ISSUE';
  }

  if (matchesAny(text, FOLLOW_UP_KEYWORDS).length > 0) {
    return 'FOLLOW_UP';
  }

  if (matchesAny(text, FIRST_VISIT_KEYWORDS).length > 0) {
    return 'FIRST_VISIT';
  }

  if (matchesAny(text, ADMIN_KEYWORDS).length > 0) {
    return 'ADMIN';
  }

  return 'ROUTINE_DENTAL';
}

export function detectMissingFields(input: TriageInput): { field: string; taskType: TriageTaskType }[] {
  const missing: { field: string; taskType: TriageTaskType }[] = [];

  if (!input.hasPostcode && !input.hasYard) {
    missing.push({ field: 'postcode', taskType: 'ASK_FOR_POSTCODE' });
  }

  if (!input.horseCount) {
    missing.push({ field: 'horseCount', taskType: 'ASK_HORSE_COUNT' });
  }

  // Check if the message text has ambiguous symptoms that need clarification
  const lower = input.messageText.toLowerCase();
  const vagueSymptoms = ['not right', 'something wrong', 'behaving oddly', 'pas normal', 'quelque chose'];
  const hasVagueSymptoms = vagueSymptoms.some((kw) => lower.includes(kw));
  const { urgency } = classifyUrgency(input.messageText);

  if (hasVagueSymptoms && urgency !== 'ROUTINE') {
    missing.push({ field: 'symptoms', taskType: 'CLARIFY_SYMPTOMS' });
  }

  return missing;
}

export function estimateDuration(input: {
  horseCount: number | null | undefined;
  requestType: RequestType;
  urgency: UrgencyLevel;
}): number {
  const count = input.horseCount ?? 1;

  // Base: 30 min for first horse, 25 min each additional
  let duration = 30;
  if (count > 1) {
    duration += (count - 1) * 25;
  }

  // First visit: +15 min
  if (input.requestType === 'FIRST_VISIT') {
    duration += 15;
  }

  // Urgent: +15 min for assessment
  if (input.urgency === 'URGENT') {
    duration += 15;
  }

  return duration;
}

// ---------------------------------------------------------------------------
// Main triage function
// ---------------------------------------------------------------------------

export function runTriageRules(input: TriageInput): TriageResult {
  const { urgency, matchedKeywords } = classifyUrgency(input.messageText);
  const requestType = input.isFirstVisit
    ? 'FIRST_VISIT'
    : classifyRequestType(input.messageText, urgency);

  const missingFields = detectMissingFields(input);
  const needsMoreInfo = missingFields.length > 0;

  const estimatedDuration = estimateDuration({
    horseCount: input.horseCount,
    requestType,
    urgency,
  });

  // Confidence: higher when we have more data and clearer signals
  let confidence = 0.5;
  if (matchedKeywords.length > 0) confidence += 0.2;
  if (input.horseCount) confidence += 0.1;
  if (input.hasPostcode || input.hasYard) confidence += 0.1;
  if (!needsMoreInfo) confidence += 0.1;
  confidence = Math.min(confidence, 1.0);

  return {
    urgency,
    requestType,
    clinicalFlags: matchedKeywords,
    needsMoreInfo,
    missingFields,
    estimatedDuration,
    confidence,
  };
}
