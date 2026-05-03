/**
 * Phase 6.3 — Reminder Service
 *
 * Schedules and sends reminders 24 hours and 2 hours before appointments.
 * Called by n8n on a 30-minute schedule via /api/reminders/check.
 */

import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email.service';
import { whatsappService } from '@/lib/services/whatsapp.service';
import { appointmentRepository } from '@/lib/repositories/appointment.repository';
import { auditLogService } from '@/lib/services/audit-log.service';
import { logger } from '@/lib/utils/logger';

interface ReminderResult {
  appointmentId: string;
  type: '24h' | '2h';
  sent: boolean;
  channel: string;
  error?: string;
}

/**
 * Phase A (May 2026 client user-story triage) — extra reminder dispatches
 * beyond the 24h/2h appointment reminders. Each follows the same shape:
 *
 * - {find candidates by a date threshold}
 * - {filter by debounce — recent AuditLog entry or `lastReminderSentAt`}
 * - {send via WhatsApp/email per the customer's preferred channel}
 * - {record the dispatch in AuditLog (and lastReminderSentAt for invoices)}
 */
export interface ExtraReminderResult {
  entityType: 'Horse' | 'Invoice';
  entityId: string;
  reminderType: 'DENTAL_DUE' | 'VACCINATION_DUE' | 'INVOICE_OVERDUE';
  sent: boolean;
  channel: string;
  error?: string;
}

const DENTAL_LOOKAHEAD_DAYS = 30;
const VACCINATION_LOOKAHEAD_DAYS = 30;
const OVERDUE_INVOICE_AFTER_DAYS = 30;
const DEBOUNCE_DAYS = 14;

function formatTime(date: Date, lang: string): string {
  return date.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildReminder24h(
  customerName: string,
  time: string,
  yardName: string,
  lang: string,
): string {
  if (lang === 'fr') {
    return `Bonjour ${customerName}, ceci est un rappel que votre rendez-vous dentaire équin est demain à ${time} à ${yardName}. Veuillez vous assurer que vos chevaux sont à jeun depuis 4 heures avant le rendez-vous. Répondez pour confirmer ou pour reporter.`;
  }
  return `Hi ${customerName}, this is a reminder that your equine dental appointment is tomorrow at ${time} at ${yardName}. Please ensure your horses have been starved for 4 hours before the appointment. Reply to confirm or if you need to reschedule.`;
}

function buildReminder2h(
  customerName: string,
  time: string,
  yardName: string,
  lang: string,
): string {
  if (lang === 'fr') {
    return `Bonjour ${customerName}, votre rendez-vous dentaire équin est dans 2 heures à ${time} à ${yardName}. Veuillez vous assurer que vos chevaux sont prêts. Répondez si vous avez des questions.`;
  }
  return `Hi ${customerName}, your equine dental appointment is in 2 hours at ${time} at ${yardName}. Please ensure your horses are ready. Reply if you have any questions.`;
}

function buildDentalDueReminder(
  customerName: string,
  horseName: string,
  dueDateLabel: string,
  lang: string,
): string {
  if (lang === 'fr') {
    return `Bonjour ${customerName}, le contrôle dentaire annuel de ${horseName} est prévu pour le ${dueDateLabel}. Souhaitez-vous prendre rendez-vous ? Répondez à ce message et nous vous proposerons des créneaux.`;
  }
  return `Hi ${customerName}, ${horseName}'s annual dental check is due ${dueDateLabel}. Would you like to book a visit? Reply to this message and we'll propose some slots.`;
}

function buildVaccinationDueReminder(
  customerName: string,
  horseName: string,
  dueDateLabel: string,
  lang: string,
): string {
  if (lang === 'fr') {
    return `Bonjour ${customerName}, la vaccination annuelle de ${horseName} est prévue pour le ${dueDateLabel}. Merci de prendre contact avec votre vétérinaire pour planifier l'injection.`;
  }
  return `Hi ${customerName}, ${horseName}'s annual vaccination is due ${dueDateLabel}. Please contact your vet to schedule the injection.`;
}

function buildOverdueInvoiceReminder(
  customerName: string,
  invoiceNumber: string,
  amountLabel: string,
  daysPastDue: number,
  lang: string,
): string {
  if (lang === 'fr') {
    return `Bonjour ${customerName}, notre facture ${invoiceNumber} (${amountLabel}) est en retard de ${daysPastDue} jours. Merci de procéder au règlement à votre meilleure convenance, ou répondez si vous avez une question.`;
  }
  return `Hi ${customerName}, our invoice ${invoiceNumber} (${amountLabel}) is ${daysPastDue} days past due. Please settle when convenient, or reply if you have a question.`;
}

function formatDueDate(date: Date, lang: string): string {
  return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function hasRecentReminder(
  entityType: string,
  entityId: string,
  action: string,
  withinDays: number,
): Promise<boolean> {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
  const recent = await prisma.auditLog.findFirst({
    where: { entityType, entityId, action, createdAt: { gte: since } },
    select: { id: true },
  });
  return recent !== null;
}

export const reminderService = {
  buildReminder24h,
  buildReminder2h,

  /**
   * Check for and send all due reminders.
   * Called by the /api/reminders/check endpoint.
   */
  async checkAndSendReminders(): Promise<ReminderResult[]> {
    const results: ReminderResult[] = [];

    // Check 24h reminders
    const due24h = await appointmentRepository.findDueForReminder('24h');
    for (const appt of due24h) {
      const result = await this.sendReminder(appt, '24h');
      results.push(result);
    }

    // Check 2h reminders
    const due2h = await appointmentRepository.findDueForReminder('2h');
    for (const appt of due2h) {
      const result = await this.sendReminder(appt, '2h');
      results.push(result);
    }

    return results;
  },

  /**
   * Send a single reminder for an appointment.
   */
  async sendReminder(
    appointment: Awaited<ReturnType<typeof appointmentRepository.findDueForReminder>>[number],
    type: '24h' | '2h',
  ): Promise<ReminderResult> {
    const customer = appointment.visitRequest.customer;
    const yard = appointment.visitRequest.yard;
    const lang = customer.preferredLanguage || 'en';
    const time = formatTime(appointment.appointmentStart, lang);
    const yardName = yard?.yardName ?? '';

    const message = type === '24h'
      ? buildReminder24h(customer.fullName, time, yardName, lang)
      : buildReminder2h(customer.fullName, time, yardName, lang);

    const channel = customer.preferredChannel;
    let sent = false;
    let error: string | undefined;

    if (channel === 'EMAIL' && customer.email) {
      const subject = lang === 'fr'
        ? `Rappel de rendez-vous — ${type === '24h' ? 'Demain' : 'Dans 2 heures'}`
        : `Appointment Reminder — ${type === '24h' ? 'Tomorrow' : 'In 2 hours'}`;

      const result = await emailService.sendBrandedEmail(
        customer.email,
        subject,
        message,
        lang,
        appointment.visitRequest.enquiryId ?? undefined,
      );
      sent = result.success;
      if (!sent) error = 'Email send failed';
    } else if (channel === 'WHATSAPP' && customer.mobilePhone) {
      // Real outbound: deterministic operation key per (appointment ×
      // reminder-type) keeps retries idempotent across the 30-min cron
      // cadence.
      const result = await whatsappService.sendTextMessage(
        customer.mobilePhone,
        message,
        appointment.visitRequest.enquiryId ?? undefined,
        lang,
        { operationKey: `wa-reminder-${type}:${appointment.id}` },
      );
      sent = result.success;
      if (!sent) error = 'WhatsApp send failed';
    } else {
      error = `No valid contact for channel ${channel}`;
    }

    if (sent) {
      const updateData = type === '24h'
        ? { reminderSentAt24h: new Date() }
        : { reminderSentAt2h: new Date() };

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: updateData,
      });
    }

    return { appointmentId: appointment.id, type, sent, channel, error };
  },

  buildDentalDueReminder,
  buildVaccinationDueReminder,
  buildOverdueInvoiceReminder,

  /**
   * G-3a — Annual dental reminders.
   *
   * Scans active horses with `dentalDueDate` within the next 30 days.
   * Sends one WhatsApp/email reminder per horse, debounced by AuditLog
   * (no resend within 14 days). Soft-deleted horses are skipped via the
   * default Prisma extension filter.
   */
  async dispatchDentalDueReminders(now: Date = new Date()): Promise<ExtraReminderResult[]> {
    const lookahead = new Date(now.getTime() + DENTAL_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const horses = await prisma.horse.findMany({
      where: {
        deletedAt: null,
        active: true,
        dentalDueDate: { gte: now, lte: lookahead },
      },
      include: { customer: true },
    });

    const results: ExtraReminderResult[] = [];
    for (const horse of horses) {
      if (!horse.dentalDueDate) continue;
      const debounced = await hasRecentReminder('Horse', horse.id, 'DENTAL_REMINDER_SENT', DEBOUNCE_DAYS);
      if (debounced) continue;

      const lang = horse.customer.preferredLanguage || 'en';
      const message = buildDentalDueReminder(
        horse.customer.fullName,
        horse.horseName,
        formatDueDate(horse.dentalDueDate, lang),
        lang,
      );
      const result = await this.sendCustomerReminder({
        entityType: 'Horse',
        entityId: horse.id,
        reminderType: 'DENTAL_DUE',
        action: 'DENTAL_REMINDER_SENT',
        message,
        customer: horse.customer,
        operationKey: `dental-${horse.id}-${now.toISOString().slice(0, 10)}`,
      });
      results.push(result);
    }
    return results;
  },

  /**
   * G-3b — Annual vaccination reminders.
   *
   * Same shape as the dental dispatch, keyed off the new
   * `vaccinationDueDate` column added in this migration.
   */
  async dispatchVaccinationDueReminders(now: Date = new Date()): Promise<ExtraReminderResult[]> {
    const lookahead = new Date(now.getTime() + VACCINATION_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const horses = await prisma.horse.findMany({
      where: {
        deletedAt: null,
        active: true,
        vaccinationDueDate: { gte: now, lte: lookahead },
      },
      include: { customer: true },
    });

    const results: ExtraReminderResult[] = [];
    for (const horse of horses) {
      if (!horse.vaccinationDueDate) continue;
      const debounced = await hasRecentReminder('Horse', horse.id, 'VACCINATION_REMINDER_SENT', DEBOUNCE_DAYS);
      if (debounced) continue;

      const lang = horse.customer.preferredLanguage || 'en';
      const message = buildVaccinationDueReminder(
        horse.customer.fullName,
        horse.horseName,
        formatDueDate(horse.vaccinationDueDate, lang),
        lang,
      );
      const result = await this.sendCustomerReminder({
        entityType: 'Horse',
        entityId: horse.id,
        reminderType: 'VACCINATION_DUE',
        action: 'VACCINATION_REMINDER_SENT',
        message,
        customer: horse.customer,
        operationKey: `vaccine-${horse.id}-${now.toISOString().slice(0, 10)}`,
      });
      results.push(result);
    }
    return results;
  },

  /**
   * G-3c — Overdue invoice reminders.
   *
   * Scans invoices with status=OVERDUE and dueAt earlier than 30 days ago.
   * Debounces via the new `lastReminderSentAt` column on Invoice — skips
   * any invoice with a fresh value within the 14-day debounce window.
   * Updates `lastReminderSentAt` on success.
   *
   * Channel is forced to WhatsApp per the client acceptance criterion in
   * `docs/CLIENT_USER_STORY_TRIAGE.md` §1 ("Reminder is sent via WhatsApp").
   * Falls back to email if the customer has no mobile phone on file.
   */
  async dispatchOverdueInvoiceReminders(now: Date = new Date()): Promise<ExtraReminderResult[]> {
    const cutoff = new Date(now.getTime() - OVERDUE_INVOICE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const debounceCutoff = new Date(now.getTime() - DEBOUNCE_DAYS * 24 * 60 * 60 * 1000);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: 'OVERDUE',
        dueAt: { lt: cutoff },
        OR: [
          { lastReminderSentAt: null },
          { lastReminderSentAt: { lt: debounceCutoff } },
        ],
      },
      include: { customer: true },
    });

    const results: ExtraReminderResult[] = [];
    for (const invoice of invoices) {
      const daysPastDue = Math.floor((now.getTime() - invoice.dueAt.getTime()) / (24 * 60 * 60 * 1000));
      const lang = invoice.customer.preferredLanguage || 'en';
      const amountLabel = `${invoice.currency} ${invoice.total.toString()}`;
      const message = buildOverdueInvoiceReminder(
        invoice.customer.fullName,
        invoice.invoiceNumber,
        amountLabel,
        daysPastDue,
        lang,
      );
      const result = await this.sendCustomerReminder({
        entityType: 'Invoice',
        entityId: invoice.id,
        reminderType: 'INVOICE_OVERDUE',
        action: 'INVOICE_OVERDUE_REMINDER_SENT',
        message,
        customer: invoice.customer,
        // Hard-channel WhatsApp per acceptance criterion. Email is a
        // fallback inside sendCustomerReminder when the customer has no
        // mobile phone on file.
        forcedChannel: 'WHATSAPP',
        operationKey: `invoice-overdue-${invoice.id}-${now.toISOString().slice(0, 10)}`,
      });
      if (result.sent) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { lastReminderSentAt: now },
        });
      }
      results.push(result);
    }
    return results;
  },

  /**
   * Shared dispatch path for the three new customer-facing reminders.
   * Sends via the customer's preferred channel (or `forcedChannel` if
   * supplied), records an AuditLog entry on success, and returns a
   * normalised result.
   */
  async sendCustomerReminder(input: {
    entityType: 'Horse' | 'Invoice';
    entityId: string;
    reminderType: ExtraReminderResult['reminderType'];
    action: string;
    message: string;
    customer: {
      fullName: string;
      mobilePhone: string | null;
      email: string | null;
      preferredChannel: string;
      preferredLanguage: string | null;
    };
    operationKey: string;
    forcedChannel?: 'WHATSAPP' | 'EMAIL';
  }): Promise<ExtraReminderResult> {
    const lang = input.customer.preferredLanguage || 'en';
    let channel: 'WHATSAPP' | 'EMAIL';
    if (input.forcedChannel === 'WHATSAPP' && input.customer.mobilePhone) {
      channel = 'WHATSAPP';
    } else if (input.forcedChannel === 'EMAIL' && input.customer.email) {
      channel = 'EMAIL';
    } else if (input.customer.preferredChannel === 'EMAIL' && input.customer.email) {
      channel = 'EMAIL';
    } else if (input.customer.mobilePhone) {
      channel = 'WHATSAPP';
    } else if (input.customer.email) {
      channel = 'EMAIL';
    } else {
      return {
        entityType: input.entityType,
        entityId: input.entityId,
        reminderType: input.reminderType,
        sent: false,
        channel: 'NONE',
        error: 'No valid contact channel for customer',
      };
    }

    let sent = false;
    let error: string | undefined;
    try {
      if (channel === 'WHATSAPP' && input.customer.mobilePhone) {
        const result = await whatsappService.sendTextMessage(
          input.customer.mobilePhone,
          input.message,
          undefined,
          lang,
          { operationKey: input.operationKey },
        );
        sent = result.success;
        if (!sent) error = 'WhatsApp send failed';
      } else if (channel === 'EMAIL' && input.customer.email) {
        const subject = lang === 'fr' ? 'Rappel EquiSmile' : 'EquiSmile reminder';
        const result = await emailService.sendBrandedEmail(
          input.customer.email,
          subject,
          input.message,
          lang,
        );
        sent = result.success;
        if (!sent) error = 'Email send failed';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown send error';
      logger.error('Customer reminder dispatch failed', {
        service: 'reminder-service',
        reminderType: input.reminderType,
        entityType: input.entityType,
        entityId: input.entityId,
        error,
      });
    }

    if (sent) {
      await auditLogService.record({
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actor: null,
        details: { channel, reminderType: input.reminderType },
      });
    }

    return {
      entityType: input.entityType,
      entityId: input.entityId,
      reminderType: input.reminderType,
      sent,
      channel,
      error,
    };
  },
};
