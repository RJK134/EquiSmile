/**
 * Phase 7.8 — Environment validation and startup pre-flight checks.
 *
 * Fails fast on critical missing vars, warns on optional ones.
 * Validates URL formats and port ranges.
 */

interface EnvCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_VARS = ['DATABASE_URL'] as const;

const OPTIONAL_GROUPS: Array<{ label: string; vars: string[] }> = [
  {
    label: 'WhatsApp',
    vars: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN'],
  },
  {
    label: 'Email/SMTP',
    vars: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'],
  },
  {
    label: 'Google Maps',
    vars: ['GOOGLE_MAPS_API_KEY'],
  },
  {
    label: 'n8n',
    vars: ['N8N_API_KEY'],
  },
];

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidPort(value: string): boolean {
  const port = parseInt(value, 10);
  return !isNaN(port) && port >= 1 && port <= 65535;
}

export function checkEnvironment(): EnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required vars
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      errors.push(`Missing required env var: ${key}`);
    }
  }

  // Validate DATABASE_URL format
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.startsWith('postgres')) {
    errors.push(`DATABASE_URL must be a PostgreSQL connection string (starts with postgres://)`);
  }

  // Validate URL formats
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !isValidUrl(appUrl)) {
    errors.push(`NEXT_PUBLIC_APP_URL is not a valid URL: ${appUrl}`);
  }

  // Validate port ranges
  const smtpPort = process.env.SMTP_PORT;
  if (smtpPort && !isValidPort(smtpPort)) {
    warnings.push(`SMTP_PORT is not a valid port number: ${smtpPort}`);
  }

  const n8nPort = process.env.N8N_PORT;
  if (n8nPort && !isValidPort(n8nPort)) {
    warnings.push(`N8N_PORT is not a valid port number: ${n8nPort}`);
  }

  // Optional groups — warn if partially configured
  for (const group of OPTIONAL_GROUPS) {
    const present = group.vars.filter((v) => !!process.env[v]);
    const missing = group.vars.filter((v) => !process.env[v]);

    if (present.length > 0 && missing.length > 0) {
      warnings.push(
        `${group.label} partially configured (missing: ${missing.join(', ')}). ${group.label} features may not work correctly.`
      );
    } else if (missing.length === group.vars.length) {
      warnings.push(
        `${group.label} not configured. ${group.label} features will be unavailable.`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Run at startup — logs warnings and throws on critical errors.
 */
export function validateEnvironmentOrThrow(): void {
  const result = checkEnvironment();

  for (const warning of result.warnings) {
    console.warn(`[EquiSmile] WARNING: ${warning}`);
  }

  if (!result.valid) {
    const errorMsg = result.errors.join('\n  - ');
    throw new Error(
      `[EquiSmile] Environment validation failed:\n  - ${errorMsg}\n\nFix these issues before starting the application.`
    );
  }
}
