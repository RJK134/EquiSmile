import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // n8n
  N8N_BASIC_AUTH_ACTIVE: z.string().optional().default('true'),
  N8N_BASIC_AUTH_USER: z.string().optional().default('admin'),
  N8N_BASIC_AUTH_PASSWORD: z.string().optional().default('changeme'),
  N8N_PORT: z.string().optional().default('5678'),
  N8N_PROTOCOL: z.string().optional().default('http'),
  N8N_HOST: z.string().optional().default('localhost'),
  N8N_API_KEY: z.string().optional().default(''),
  N8N_WEBHOOK_URL: z.string().optional().default(''),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  GCP_PROJECT_ID: z.string().optional().default(''),

  // WhatsApp (Meta Cloud API)
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_API_TOKEN: z.string().optional().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().optional().default(''),
  WHATSAPP_APP_SECRET: z.string().optional().default(''),

  // Email (IMAP/SMTP)
  IMAP_HOST: z.string().optional().default(''),
  IMAP_PORT: z.string().optional().default('993'),
  IMAP_USER: z.string().optional().default(''),
  IMAP_PASSWORD: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.string().optional().default('587'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),

  // Home Base (route planning)
  HOME_BASE_ADDRESS: z.string().optional().default(''),
  HOME_BASE_LAT: z.string().optional().default(''),
  HOME_BASE_LNG: z.string().optional().default(''),

  // App
  NEXT_PUBLIC_APP_URL: z
    .string()
    .optional()
    .default('http://localhost:3000'),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().optional().default('en'),
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Environment variable validation failed:\n${formatted}`
    );
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Exported env object — validated at import time in server context
// ---------------------------------------------------------------------------

export const env = validateEnv();

// ---------------------------------------------------------------------------
// Startup warnings for optional messaging variables
// ---------------------------------------------------------------------------

const MESSAGING_WARNINGS: Array<{ keys: string[]; label: string }> = [
  {
    keys: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'],
    label: 'WhatsApp',
  },
  {
    keys: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'],
    label: 'Email/SMTP',
  },
  {
    keys: ['N8N_API_KEY'],
    label: 'n8n integration',
  },
];

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  for (const group of MESSAGING_WARNINGS) {
    const missing = group.keys.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.warn(
        `[EquiSmile] ${group.label} not configured (missing: ${missing.join(', ')}). ` +
          `${group.label} features will be unavailable until these are set.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Utility: list required variables that are missing (for health check)
// ---------------------------------------------------------------------------

const REQUIRED_KEYS = ['DATABASE_URL'] as const;

export function getMissingRequiredVars(): string[] {
  return REQUIRED_KEYS.filter((key) => !process.env[key]);
}

// ---------------------------------------------------------------------------
// n8n URL helper
// ---------------------------------------------------------------------------

export function getN8nBaseUrl(): string {
  return `${env.N8N_PROTOCOL}://${env.N8N_HOST}:${env.N8N_PORT}`;
}
