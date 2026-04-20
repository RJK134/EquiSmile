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

// Auth vars are required in non-demo mode (the app requires sign-in to access any UI).
// AUTH_SECRET + ALLOWED_GITHUB_LOGINS are always required; at least one provider
// (GitHub or Email magic-link) must be configured.
const AUTH_REQUIRED_VARS = ['AUTH_SECRET', 'ALLOWED_GITHUB_LOGINS'] as const;
const AUTH_GITHUB_VARS = ['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'] as const;
const AUTH_EMAIL_SMTP_VARS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'] as const;

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

  // Auth vars — required unless explicitly in demo mode.
  const demoMode = process.env.DEMO_MODE === 'true';
  if (!demoMode) {
    for (const key of AUTH_REQUIRED_VARS) {
      if (!process.env[key]) {
        errors.push(`Missing required auth env var: ${key}`);
      }
    }

    const githubConfigured = AUTH_GITHUB_VARS.every((k) => !!process.env[k]);
    const emailEnabled = process.env.AUTH_EMAIL_ENABLED === 'true';
    const smtpConfigured = AUTH_EMAIL_SMTP_VARS.every((k) => !!process.env[k]);
    const emailProviderReady = emailEnabled && smtpConfigured;

    if (!githubConfigured && !emailProviderReady) {
      errors.push(
        'At least one auth provider must be configured: set AUTH_GITHUB_ID + AUTH_GITHUB_SECRET, or set AUTH_EMAIL_ENABLED=true with SMTP_HOST + SMTP_USER + SMTP_PASSWORD.',
      );
    }

    if (emailEnabled && !smtpConfigured) {
      errors.push(
        'AUTH_EMAIL_ENABLED=true but SMTP is not fully configured (need SMTP_HOST, SMTP_USER, SMTP_PASSWORD).',
      );
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
