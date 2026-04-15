/**
 * Phone number normalisation to E.164 format.
 * Handles UK (+44) and French (+33) numbers commonly used by EquiSmile clients.
 */

/** Remove all non-digit characters except leading + */
function stripNonDigits(phone: string): string {
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normalise a phone number to E.164 format.
 * - Already E.164 (+44..., +33...): returned as-is (stripped of spaces/dashes)
 * - UK local (07...): prefixed with +44, leading 0 removed
 * - French local (06..., 07...): prefixed with +33, leading 0 removed
 * - Other formats with country code (0044..., 0033...): converted to +XX
 * Returns null if the input cannot be normalised.
 */
export function normalisePhone(raw: string): string | null {
  if (!raw || raw.trim().length === 0) return null;

  const cleaned = stripNonDigits(raw.trim());

  // Already E.164
  if (cleaned.startsWith('+') && cleaned.length >= 10 && cleaned.length <= 16) {
    return cleaned;
  }

  // UK: 00 44 prefix
  if (cleaned.startsWith('0044')) {
    const number = cleaned.slice(4);
    if (number.length >= 9 && number.length <= 12) return `+44${number}`;
  }

  // France: 00 33 prefix
  if (cleaned.startsWith('0033')) {
    const number = cleaned.slice(4);
    if (number.length >= 9 && number.length <= 12) return `+33${number}`;
  }

  // UK local (07...) — 11 digits total
  if (cleaned.startsWith('07') && cleaned.length === 11) {
    return `+44${cleaned.slice(1)}`;
  }

  // French local (06..., 07...) — 10 digits total
  if ((cleaned.startsWith('06') || cleaned.startsWith('07')) && cleaned.length === 10) {
    return `+33${cleaned.slice(1)}`;
  }

  // UK landline (01..., 02..., 03...) — 10-11 digits
  if (/^0[1-3]/.test(cleaned) && cleaned.length >= 10 && cleaned.length <= 11) {
    return `+44${cleaned.slice(1)}`;
  }

  // Generic: already starts with country code digits (44..., 33...)
  if (cleaned.startsWith('44') && cleaned.length >= 11 && cleaned.length <= 13) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('33') && cleaned.length >= 11 && cleaned.length <= 13) {
    return `+${cleaned}`;
  }

  return null;
}

/** Check if a string looks like a valid E.164 phone number */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}
