/** Supported locales */
export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

/** Default locale */
export const DEFAULT_LOCALE: Locale = 'en';

/** App metadata */
export const APP_NAME = 'EquiSmile';
export const APP_VERSION = '0.1.0';

/** Urgency keywords for triage classification */
export const URGENT_KEYWORDS = [
  'pain',
  'swelling',
  'bleeding',
  'not eating',
  'distress',
  'emergency',
  'urgent',
] as const;

/** Default estimated duration for a routine dental visit (minutes) */
export const DEFAULT_VISIT_DURATION_MINUTES = 45;

/** Maximum stops per route run */
export const MAX_STOPS_PER_ROUTE = 8;
