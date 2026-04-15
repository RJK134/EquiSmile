/**
 * Environment variable validation.
 * Placeholder — will be expanded in Phase 1 with full validation
 * and named-variable startup errors.
 */

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}
