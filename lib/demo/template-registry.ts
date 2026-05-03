/**
 * Demo template registry — mirrors the shape of Meta-approved
 * WhatsApp Business templates so the in-app code can pick a
 * template name and parameters today, ready to swap to real
 * Meta templates in production with no caller change.
 *
 * Real Meta templates require: business onboarding, template
 * submission via Meta Business Manager, ~24h approval. See
 * docs/OPERATIONS.md §1 for the token + onboarding runbook.
 *
 * The names below match the env-var defaults consumed by
 * lib/services/confirmation.service.ts and lib/services/reminder.service.ts:
 *   WHATSAPP_CONFIRMATION_TEMPLATE  → appointment_confirmation_v1
 *   WHATSAPP_REMINDER_TEMPLATE       → appointment_reminder_v1
 *
 * In production, the env var should point at the actual approved
 * template name on the Meta side (which may carry a different
 * version suffix per locale or per business account).
 */

export interface TemplateDefinition {
  /** Template name as registered with Meta. Must match exactly. */
  name: string;
  /** Locales the template has been registered in (Meta requires per-locale approval). */
  languages: ('en' | 'fr')[];
  /**
   * Ordered list of body parameters Meta expects. The caller MUST
   * pass values in this order — Meta resolves them positionally.
   */
  parameters: string[];
  /** Whether the template has been approved by Meta. Demo entries are always true. */
  approved: boolean;
  /** Meta template category (drives free-message-window rules). */
  category: 'APPOINTMENT_UPDATE' | 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
}

export const DEMO_TEMPLATES: Record<string, TemplateDefinition> = {
  appointment_confirmation_v1: {
    name: 'appointment_confirmation_v1',
    languages: ['en', 'fr'],
    parameters: ['customer_name', 'date', 'time', 'yard_name', 'horse_count'],
    approved: true,
    category: 'APPOINTMENT_UPDATE',
  },
  appointment_reminder_v1: {
    name: 'appointment_reminder_v1',
    languages: ['en', 'fr'],
    parameters: ['customer_name', 'date', 'time', 'yard_name'],
    approved: true,
    category: 'APPOINTMENT_UPDATE',
  },
};

/**
 * Convenience accessor. Throws if the env-configured template name
 * isn't in the registry, which on a fresh deploy means the operator
 * still needs to register it with Meta and wire the matching env var.
 */
export function getTemplate(name: string): TemplateDefinition {
  const t = DEMO_TEMPLATES[name];
  if (!t) {
    throw new Error(
      `Unknown WhatsApp template "${name}" — register it in lib/demo/template-registry.ts ` +
        `and ensure it has been approved on the Meta side.`,
    );
  }
  return t;
}
