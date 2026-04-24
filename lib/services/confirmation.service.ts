/**
 * Phase 6.2 — Confirmation Dispatch Service
 *
 * Sends bilingual confirmation messages to customers via their preferred channel.
 */

import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email.service';
import { whatsappService } from '@/lib/services/whatsapp.service';
import { appointmentAuditService } from '@/lib/services/appointment-audit.service';
import { logger } from '@/lib/utils/logger';
import type { ActorContext } from '@/lib/types/actor';
import type { ConfirmationChannel, PreferredChannel } from '@prisma/client';

interface AppointmentWithDetails {
  id: string;
  appointmentStart: Date;
  appointmentEnd: Date;
  visitRequest: {
    id: string;
    horseCount: number | null;
    enquiryId: string | null;
    customer: {
      id: string;
      fullName: string;
      mobilePhone: string | null;
      email: string | null;
      preferredChannel: PreferredChannel;
      preferredLanguage: string;
    };
    yard: {
      id: string;
      yardName: string;
      addressLine1: string;
      town: string;
      postcode: string;
    } | null;
  };
}

/**
 * Map Customer.preferredChannel (`PreferredChannel` enum) to the
 * dispatch-log `ConfirmationChannel` enum. Today the two enums share
 * the same values (WHATSAPP | EMAIL | PHONE) but they are independent
 * types in the schema, so an explicit map both keeps TypeScript honest
 * and insulates the audit write from a future divergence between the
 * two vocabularies.
 */
function toConfirmationChannel(preferred: PreferredChannel): ConfirmationChannel {
  switch (preferred) {
    case 'WHATSAPP':
      return 'WHATSAPP';
    case 'EMAIL':
      return 'EMAIL';
    case 'PHONE':
      return 'PHONE';
    default: {
      // Exhaustiveness guard: if a new PreferredChannel value is added,
      // TypeScript will flag this branch until the switch is updated.
      const _exhaustive: never = preferred;
      throw new Error(`Unsupported PreferredChannel: ${String(_exhaustive)}`);
    }
  }
}

function formatDate(date: Date, lang: string): string {
  return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(date: Date, lang: string): string {
  return date.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildConfirmationMessage(appt: AppointmentWithDetails): string {
  const customer = appt.visitRequest.customer;
  const yard = appt.visitRequest.yard;
  const lang = customer.preferredLanguage || 'en';
  const date = formatDate(appt.appointmentStart, lang);
  const startTime = formatTime(appt.appointmentStart, lang);
  const endTime = formatTime(appt.appointmentEnd, lang);
  const yardName = yard?.yardName ?? '';
  const yardAddress = yard ? `${yard.addressLine1}, ${yard.town}, ${yard.postcode}` : '';
  const horseCount = appt.visitRequest.horseCount ?? 1;

  if (lang === 'fr') {
    return `Bonjour ${customer.fullName},

Votre rendez-vous de soins dentaires équins est confirmé :

📅 Date : ${date}
⏰ Heure : ${startTime} – ${endTime}
📍 Lieu : ${yardName}, ${yardAddress}
🐴 Chevaux : ${horseCount}

Veuillez vous assurer que vos chevaux sont accessibles et à jeun depuis au moins 4 heures avant le rendez-vous.

Pour confirmer, annuler ou reporter, veuillez répondre à ce message.

Merci,
EquiSmile`;
  }

  return `Hi ${customer.fullName},

Your equine dental appointment has been confirmed:

📅 Date: ${date}
⏰ Time: ${startTime} – ${endTime}
📍 Location: ${yardName}, ${yardAddress}
🐴 Horses: ${horseCount}

Please ensure your horses are accessible and have been starved for at least 4 hours before the appointment.

To confirm, cancel, or reschedule, please reply to this message.

Thank you,
EquiSmile`;
}

interface ConfirmationResult {
  appointmentId: string;
  sent: boolean;
  channel: ConfirmationChannel;
  error?: string;
}

export const confirmationService = {
  /**
   * Build a confirmation message for an appointment (exported for testing).
   */
  buildConfirmationMessage,

  /**
   * Send confirmation for a single appointment.
   */
  async sendConfirmation(
    appointmentId: string,
    context: ActorContext = {},
  ): Promise<ConfirmationResult> {
    const actor = context.actor?.trim() || 'system';
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        visitRequest: {
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
                mobilePhone: true,
                email: true,
                preferredChannel: true,
                preferredLanguage: true,
              },
            },
            yard: {
              select: {
                id: true,
                yardName: true,
                addressLine1: true,
                town: true,
                postcode: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    const customer = appointment.visitRequest.customer;
    const lang = customer.preferredLanguage || 'en';
    const message = buildConfirmationMessage(appointment as unknown as AppointmentWithDetails);
    // Explicit `PreferredChannel → ConfirmationChannel` mapping. At
    // runtime today the two enums share values (WHATSAPP | EMAIL |
    // PHONE), but they are distinct Prisma types — piping the raw
    // `preferredChannel` straight into the audit log relied on that
    // coincidence. The exhaustiveness guard in `toConfirmationChannel`
    // will trip at compile time if either enum gains a new member.
    const channel: ConfirmationChannel = toConfirmationChannel(customer.preferredChannel);

    let sent = false;
    let error: string | undefined;
    let externalMessageId: string | null = null;

    // The outbound send is wrapped so that ANY exception still reaches
    // the ConfirmationDispatch audit write below. Without this, an
    // unexpected throw from the underlying Email/WhatsApp service would
    // skip the status-transition AND the dispatch-failure audit row,
    // defeating the AMBER-10 "every dispatch attempt is logged"
    // guarantee. The underlying services already catch most failures
    // internally and return success: false, but defence-in-depth here
    // is cheap.
    try {
      if (channel === 'EMAIL' && customer.email) {
        const subject = lang === 'fr'
          ? 'Confirmation de rendez-vous — EquiSmile'
          : 'Appointment Confirmation — EquiSmile';

        const result = await emailService.sendBrandedEmail(
          customer.email,
          subject,
          message,
          lang,
          appointment.visitRequest.enquiryId ?? undefined,
        );
        sent = result.success;
        externalMessageId = result.messageId || null;
        if (!sent) error = 'Email send failed';
      } else if (channel === 'WHATSAPP' && customer.mobilePhone) {
        // Real outbound: pass a deterministic operation key so retry /
        // replay does not re-send the same confirmation.
        const result = await whatsappService.sendTextMessage(
          customer.mobilePhone,
          message,
          appointment.visitRequest.enquiryId ?? undefined,
          lang,
          { operationKey: `wa-confirmation:${appointmentId}` },
        );
        sent = result.success;
        externalMessageId = result.messageId || null;
        if (!sent) error = 'WhatsApp send failed';
        logger.info('WhatsApp confirmation dispatched', {
          service: 'confirmation-service',
          operation: 'send-whatsapp-confirmation',
          appointmentId,
          messageId: externalMessageId,
          success: sent,
        });
      } else {
        error = `No valid contact for channel ${channel}`;
      }
    } catch (sendError) {
      // Preserve sent=false and record the exception message so the
      // ConfirmationDispatch row reflects the real failure rather than
      // dropping the audit trail entirely.
      sent = false;
      error = sendError instanceof Error ? sendError.message : String(sendError);
      logger.error('Confirmation send threw unexpectedly', sendError, {
        service: 'confirmation-service',
        operation: 'send-confirmation',
        appointmentId,
        channel,
      });
    }

    if (sent) {
      // The post-send status update uses an atomic compare-and-swap so
      // it cannot overwrite a concurrent CANCELLED (or COMPLETED)
      // transition that happened during the several-second HTTP send
      // window. The read at the top of the function produced
      // `priorStatus`, but by the time we get here the row may have
      // moved — `cancelAppointment` running in a sibling request would
      // otherwise be silently un-cancelled by a naive
      // `update({ where: { id } })`.
      const priorStatus = appointment.status;
      if (priorStatus === 'PROPOSED') {
        const { count } = await prisma.appointment.updateMany({
          where: { id: appointmentId, status: 'PROPOSED' },
          data: { status: 'CONFIRMED', confirmationSentAt: new Date() },
        });
        if (count === 1) {
          await appointmentAuditService.logStatusChange({
            appointmentId,
            fromStatus: 'PROPOSED',
            toStatus: 'CONFIRMED',
            changedBy: actor,
            reason: 'confirmation dispatched',
          });
        } else {
          // Row moved to a terminal/non-PROPOSED state during the send.
          // Do NOT stamp confirmationSentAt either — leaving the row as
          // the other writer set it is the safe default.
          logger.warn(
            'Appointment status changed during confirmation send; skipping CONFIRMED transition',
            {
              service: 'confirmation-service',
              operation: 'send-confirmation-race',
              appointmentId,
            },
          );
        }
      } else {
        // Already CONFIRMED (resend) or a later status — just stamp
        // the send timestamp; no status-history row (resends should
        // not churn the audit trail).
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: { confirmationSentAt: new Date() },
        });
      }
    }

    // AMBER-10: every dispatch attempt (success or failure) lands in the
    // ConfirmationDispatch log so we can audit multi-send history.
    await appointmentAuditService.logConfirmationDispatch({
      appointmentId,
      channel,
      success: sent,
      externalMessageId,
      errorMessage: error ?? null,
    });

    return { appointmentId, sent, channel, error };
  },

  /**
   * Send confirmations for all appointments from a route run.
   */
  async sendConfirmationsForRouteRun(
    routeRunId: string,
    context: ActorContext = {},
  ): Promise<ConfirmationResult[]> {
    const appointments = await prisma.appointment.findMany({
      where: { routeRunId },
      select: { id: true },
    });

    const results: ConfirmationResult[] = [];
    for (const appt of appointments) {
      const result = await this.sendConfirmation(appt.id, context);
      results.push(result);
    }
    return results;
  },
};
