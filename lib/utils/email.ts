/**
 * Email normalisation utilities.
 */

/** Normalise an email address: lowercase, trim whitespace */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Basic email format validation */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
