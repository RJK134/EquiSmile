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
 * lib/services/confirmation.service.ts:
 *   WHATSAPP_CONFIRMATION_TEMPLATE  → appointment_confirmation_v1
 *   WHATSAPP_REMINDER_TEMPLATE       → appointment_reminder_v1 (reserved for
 *     when reminder.service.ts is updated to send via template rather than
 *     the current free-text sendTextMessage path)
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
  // Phase A (May 2026 client user-story triage) — annual dental reminder.
  // Sent ~30 days before Horse.dentalDueDate, debounced 14d via AuditLog.
  // Reminder.service builds the body string today; this registry entry
  // exists so the dispatch path can swap to a Meta-approved template
  // when production WhatsApp Business templates are registered.
  dental_due_reminder_v1: {
    name: 'dental_due_reminder_v1',
    languages: ['en', 'fr'],
    parameters: ['customer_name', 'horse_name', 'due_date'],
    approved: true,
    category: 'UTILITY',
  },
  // Phase A — annual vaccination reminder. Same dispatch shape as dental.
  vaccination_due_reminder_v1: {
    name: 'vaccination_due_reminder_v1',
    languages: ['en', 'fr'],
    parameters: ['customer_name', 'horse_name', 'due_date'],
    approved: true,
    category: 'UTILITY',
  },
  // Phase A — overdue-invoice reminder. Sent ≥30 days past invoice due
  // date, debounced 14d via Invoice.lastReminderSentAt. WhatsApp-first
  // per the client acceptance criterion in
  // docs/CLIENT_USER_STORY_TRIAGE.md §1.
  invoice_overdue_reminder_v1: {
    name: 'invoice_overdue_reminder_v1',
    languages: ['en', 'fr'],
    parameters: ['customer_name', 'invoice_number', 'amount', 'days_past_due'],
    approved: true,
    category: 'UTILITY',
  },
  // Phase A (G-2b) — operator-picked stock replies for the triage queue.
  // The vet picks one, previews the body, confirms and sends. Hard rule
  // from the client's user story: "Automated responses must remain
  // editable and reviewable" — no silent auto-send.
  faq_acknowledge_v1: {
    name: 'faq_acknowledge_v1',
    languages: ['en', 'fr'],
    parameters: ['customer_name'],
    approved: true,
    category: 'UTILITY',
  },
  faq_request_info_v1: {
    name: 'faq_request_info_v1',
    languages: ['en', 'fr'],
    parameters: ['customer_name'],
    approved: true,
    category: 'UTILITY',
  },
  faq_routine_booking_v1: {
    name: 'faq_routine_booking_v1',
    languages: ['en', 'fr'],
    parameters: ['customer_name'],
    approved: true,
    category: 'UTILITY',
  },
  faq_emergency_redirect_v1: {
    name: 'faq_emergency_redirect_v1',
    languages: ['en', 'fr'],
    parameters: ['customer_name'],
    approved: true,
    category: 'UTILITY',
  },
};

/**
 * Stock-reply identifiers a vet can pick from the triage queue (G-2b).
 * Each maps to a Meta-approved template name above and a bilingual body
 * string defined in `lib/services/stock-reply.service.ts`. Keeping the
 * list small (4 patterns) bounds the operator decision space — when the
 * client's FAQ corpus arrives in Phase C, additional entries register
 * here.
 */
export const STOCK_REPLY_TEMPLATES = [
  'faq_acknowledge_v1',
  'faq_request_info_v1',
  'faq_routine_booking_v1',
  'faq_emergency_redirect_v1',
] as const;

export type StockReplyTemplateName = (typeof STOCK_REPLY_TEMPLATES)[number];

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
