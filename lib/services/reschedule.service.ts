/**
 * Phase 6.4 — Cancel & Reschedule Service
 *
 * Handles cancellation, rescheduling, customer-initiated cancel/reschedule detection,
 * and no-show handling.
 */

import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email.service';
import { whatsappService } from '@/lib/services/whatsapp.service';
import { logger } from '@/lib/utils/logger';
import type { ActorContext } from '@/lib/types/actor';

interface CancelResult {
  appointmentId: string;
  cancelled: boolean;
  returnedToPool: boolean;
}

interface RescheduleResult {
  appointmentId: string;
  cancelled: boolean;
  returnedToPool: boolean;
  note: string;
}

interface ParseResult {
  intent: 'cancel' | 'reschedule' | 'none';
  confidence: 'high' | 'low';
}

// ActorContext is imported from @/lib/types/actor above.

const CANCEL_KEYWORDS_EN = ['cancel', "can't make it", 'cannot make it', 'unable to attend'];
const CANCEL_KEYWORDS_FR = ['annuler', 'ne peux pas', 'ne pourrai pas', 'impossible de venir'];
const RESCHEDULE_KEYWORDS_EN = ['reschedule', 'change date', 'change the date', 'move appointment', 'different day'];
const RESCHEDULE_KEYWORDS_FR = ['reporter', 'changer', 'déplacer', 'autre date', 'modifier le rendez-vous'];

function sendCancellationAcknowledgement(
  customerName: string,
  lang: string,
): string {
  if (lang === 'fr') {
    return `Bonjour ${customerName}, votre rendez-vous a été annulé. N'hésitez pas à nous recontacter pour prendre un nouveau rendez-vous. Merci, EquiSmile`;
  }
  return `Hi ${customerName}, your appointment has been cancelled. Please don't hesitate to contact us to book a new appointment. Thank you, EquiSmile`;
}

function sendRescheduleAcknowledgement(
  customerName: string,
  lang: string,
): string {
  if (lang === 'fr') {
    return `Bonjour ${customerName}, votre rendez-vous a été annulé et sera reprogrammé. Nous vous recontacterons avec une nouvelle date. Merci, EquiSmile`;
  }
  return `Hi ${customerName}, your appointment has been cancelled and will be rescheduled. We will contact you with a new date. Thank you, EquiSmile`;
}

/**
 * Optional per-call options for the cancel path.
 *
 * `actor` threads through to the AppointmentStatusHistory audit row.
 * `notifyCustomer` exists so `rescheduleAppointment` can suppress the
 * cancel-ack — the reschedule path sends its own "has been cancelled
 * and will be rescheduled" message afterwards, and without this flag
 * the customer would receive two contradictory WhatsApp texts in
 * succession.
 *
 * The two settings live on the same bag so a caller cannot accidentally
 * pass `{ notifyCustomer: false }` into the actor slot (or vice versa):
 * with two adjacent optional-only object parameters they would be
 * structurally compatible and TypeScript would not catch the mix-up
 * except on direct object-literal calls.
 */
export interface CancelOptions extends ActorContext {
  notifyCustomer?: boolean;
}

export const rescheduleService = {
  /**
   * Cancel an appointment, return visit request to planning pool.
   */
  async cancelAppointment(
    appointmentId: string,
    reason?: string,
    options: CancelOptions = {},
  ): Promise<CancelResult> {
    const actor = options.actor?.trim() || 'system';
    const notifyCustomer = options.notifyCustomer ?? true;

    // 1. Do all DB work inside the transaction. External sends are
    //    deliberately excluded: whatsappService retries twice with a
    //    15s per-attempt timeout (~45s worst case) which would blow
    //    past Prisma's 5s interactive-transaction timeout and roll
    //    back the cancellation AFTER the customer has already received
    //    the "your appointment is cancelled" message. Keep the outbound
    //    dispatch strictly post-commit.
    const { customer, lang, enquiryId } = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          visitRequest: {
            include: {
              customer: {
                select: {
                  fullName: true,
                  email: true,
                  mobilePhone: true,
                  preferredChannel: true,
                  preferredLanguage: true,
                },
              },
            },
          },
        },
      });

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
        throw new Error(`Cannot cancel appointment with status: ${appointment.status}`);
      }

      const priorStatus = appointment.status;
      await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason ?? null,
        },
      });
      // AMBER-13 — status history row for the transition. Actor threads
      // down from the route handler so operator-triggered cancellations
      // record the real user rather than 'system'.
      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: priorStatus,
          toStatus: 'CANCELLED',
          changedBy: actor,
          reason: reason ?? null,
        },
      });

      await tx.visitRequest.update({
        where: { id: appointment.visitRequestId },
        data: { planningStatus: 'PLANNING_POOL' },
      });

      if (appointment.routeRunId) {
        await tx.routeRunStop.updateMany({
          where: {
            routeRunId: appointment.routeRunId,
            visitRequestId: appointment.visitRequestId,
          },
          data: { stopStatus: 'SKIPPED' },
        });

        const remainingStops = await tx.routeRunStop.count({
          where: {
            routeRunId: appointment.routeRunId,
            stopStatus: { not: 'SKIPPED' },
          },
        });

        await tx.routeRun.update({
          where: { id: appointment.routeRunId },
          data: { totalJobs: remainingStops },
        });
      }

      return {
        customer: appointment.visitRequest.customer,
        lang: appointment.visitRequest.customer.preferredLanguage || 'en',
        enquiryId: appointment.visitRequest.enquiryId ?? undefined,
      };
    });

    // 2. Post-commit: send the customer acknowledgement, unless the
    //    caller (e.g. the reschedule path) explicitly told us not to.
    //    The send is idempotent (`wa-cancel:<appointmentId>` operation
    //    key), so a retry after a transient failure here will not
    //    double-message the customer.
    //
    //    The whole block is try-wrapped: the cancellation has already
    //    been committed by this point, so any send-side failure must
    //    NOT propagate and turn into a 500 — that would mask the
    //    successful state change and trick the caller into retrying,
    //    which would hit "Cannot cancel appointment with status:
    //    CANCELLED" on the second attempt. Failed sends are already
    //    captured by the underlying services (dead-letter queue +
    //    ConfirmationDispatch); we just need to keep them out of the
    //    success path.
    if (notifyCustomer) {
      try {
        const message = sendCancellationAcknowledgement(customer.fullName, lang);
        if (customer.preferredChannel === 'EMAIL' && customer.email) {
          const subject = lang === 'fr'
            ? 'Annulation de rendez-vous — EquiSmile'
            : 'Appointment Cancelled — EquiSmile';
          await emailService.sendBrandedEmail(
            customer.email,
            subject,
            message,
            lang,
            enquiryId,
          );
        } else if (customer.preferredChannel === 'WHATSAPP' && customer.mobilePhone) {
          await whatsappService.sendTextMessage(
            customer.mobilePhone,
            message,
            enquiryId,
            lang,
            { operationKey: `wa-cancel:${appointmentId}` },
          );
        }
      } catch (notifyError) {
        logger.error(
          'Cancellation acknowledgement failed AFTER cancel was committed; returning success',
          notifyError,
          {
            service: 'reschedule-service',
            operation: 'cancel-notify',
            appointmentId,
          },
        );
      }
    }

    return {
      appointmentId,
      cancelled: true,
      returnedToPool: true,
    };
  },

  /**
   * Reschedule an appointment: cancel and return to pool with note.
   */
  async rescheduleAppointment(
    appointmentId: string,
    notes?: string,
    context: ActorContext = {},
  ): Promise<RescheduleResult> {
    // Suppress the cancellation ack inside cancelAppointment — we send
    // our own "cancelled and will be rescheduled" message below.
    // Without this the customer receives two contradictory WhatsApp
    // messages back-to-back (cancelled, then cancelled-and-rescheduled).
    const cancelResult = await this.cancelAppointment(
      appointmentId,
      'Rescheduled',
      { actor: context.actor, notifyCustomer: false },
    );

    // Update the visit request with rescheduling note
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        visitRequestId: true,
        visitRequest: {
          include: {
            customer: {
              select: {
                fullName: true,
                email: true,
                mobilePhone: true,
                preferredChannel: true,
                preferredLanguage: true,
              },
            },
          },
        },
      },
    });

    if (appointment) {
      // Same try-wrap rationale as cancelAppointment: the underlying
      // cancel transaction has already committed, so a send-side
      // exception here must not be re-thrown — that would 500 the
      // operator and trick a retry into hitting "Cannot cancel
      // appointment with status: CANCELLED" on the second try.
      try {
        const customer = appointment.visitRequest.customer;
        const lang = customer.preferredLanguage || 'en';
        const message = sendRescheduleAcknowledgement(customer.fullName, lang);

        if (customer.preferredChannel === 'EMAIL' && customer.email) {
          const subject = lang === 'fr'
            ? 'Report de rendez-vous — EquiSmile'
            : 'Appointment Rescheduled — EquiSmile';
          await emailService.sendBrandedEmail(
            customer.email,
            subject,
            message,
            lang,
            appointment.visitRequest.enquiryId ?? undefined,
          );
        } else if (customer.preferredChannel === 'WHATSAPP' && customer.mobilePhone) {
          await whatsappService.sendTextMessage(
            customer.mobilePhone,
            message,
            appointment.visitRequest.enquiryId ?? undefined,
            lang,
            { operationKey: `wa-reschedule:${appointmentId}` },
          );
        }
      } catch (notifyError) {
        logger.error(
          'Reschedule acknowledgement failed AFTER reschedule was committed; returning success',
          notifyError,
          {
            service: 'reschedule-service',
            operation: 'reschedule-notify',
            appointmentId,
          },
        );
      }
    }

    return {
      ...cancelResult,
      note: notes ?? 'Appointment rescheduled — returned to planning pool',
    };
  },

  /**
   * Parse an inbound message for cancel/reschedule intent.
   */
  parseCustomerIntent(messageText: string): ParseResult {
    const lower = messageText.toLowerCase();

    for (const kw of CANCEL_KEYWORDS_EN) {
      if (lower.includes(kw)) return { intent: 'cancel', confidence: 'high' };
    }
    for (const kw of CANCEL_KEYWORDS_FR) {
      if (lower.includes(kw)) return { intent: 'cancel', confidence: 'high' };
    }
    for (const kw of RESCHEDULE_KEYWORDS_EN) {
      if (lower.includes(kw)) return { intent: 'reschedule', confidence: 'high' };
    }
    for (const kw of RESCHEDULE_KEYWORDS_FR) {
      if (lower.includes(kw)) return { intent: 'reschedule', confidence: 'high' };
    }

    return { intent: 'none', confidence: 'low' };
  },

  /**
   * Mark an appointment as no-show (admin action).
   */
  async markNoShow(appointmentId: string, context: ActorContext = {}): Promise<void> {
    const actor = context.actor?.trim() || 'system';
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      throw new Error(`Cannot mark as no-show: appointment is ${appointment.status}`);
    }

    const priorStatus = appointment.status;
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'NO_SHOW' },
    });
    await prisma.appointmentStatusHistory.create({
      data: {
        appointmentId,
        fromStatus: priorStatus,
        toStatus: 'NO_SHOW',
        changedBy: actor,
      },
    });
  },
};
