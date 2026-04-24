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

interface ReminderResult {
  appointmentId: string;
  type: '24h' | '2h';
  sent: boolean;
  channel: string;
  error?: string;
}

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
};
