/**
 * Basic message text parser for extracting structured info from raw messages.
 * Used during intake to pre-populate triage fields.
 */

export interface ParsedMessageInfo {
  horseCount: number | null;
  postcodes: string[];
  isUrgent: boolean;
  keywords: string[];
}

/** UK postcode pattern (e.g., SW1A 1AA, M1 1AA, B1 1BB) */
const UK_POSTCODE_REGEX =
  /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi;

/** French postcode pattern (5 digits) */
const FR_POSTCODE_REGEX = /\b(\d{5})\b/g;

/** Urgency keywords (EN + FR) */
const URGENCY_KEYWORDS = [
  'urgent',
  'emergency',
  'pain',
  'bleeding',
  'broken',
  'swollen',
  'can\'t eat',
  'cannot eat',
  'won\'t eat',
  'quidding',
  'urgence',
  'douleur',
  'saignement',
  'cassé',
  'enflé',
  'ne mange pas',
  'colique',
  'colic',
  'asap',
  'immediately',
  'immédiatement',
];

/** Horse count patterns */
const HORSE_COUNT_PATTERNS = [
  /(\d+)\s*horse/i,
  /(\d+)\s*cheva(?:l|ux)/i,
  /horse(?:s)?\s*[:=]\s*(\d+)/i,
  /cheva(?:l|ux)\s*[:=]\s*(\d+)/i,
];

/**
 * Parse a raw message to extract structured info.
 */
export function parseMessage(text: string): ParsedMessageInfo {
  const lower = text.toLowerCase();

  // Extract horse count
  let horseCount: number | null = null;
  for (const pattern of HORSE_COUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > 0 && n <= 100) {
        horseCount = n;
        break;
      }
    }
  }

  // Extract postcodes
  const ukPostcodes = Array.from(text.matchAll(UK_POSTCODE_REGEX)).map(
    (m) => m[1].toUpperCase().replace(/\s+/g, ' ')
  );
  const frPostcodes = Array.from(text.matchAll(FR_POSTCODE_REGEX)).map(
    (m) => m[1]
  );
  const postcodes = [...new Set([...ukPostcodes, ...frPostcodes])];

  // Check urgency
  const isUrgent = URGENCY_KEYWORDS.some((kw) => lower.includes(kw));

  // Extract matched keywords
  const keywords = URGENCY_KEYWORDS.filter((kw) => lower.includes(kw));

  return { horseCount, postcodes, isUrgent, keywords };
}
