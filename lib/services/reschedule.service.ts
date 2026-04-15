/**
 * Phase 6.4 — Cancel & Reschedule Service
 *
 * Handles cancellation, rescheduling, customer-initiated cancel/reschedule detection,
 * and no-show handling.
 */

import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email.service';
import { messageLogService } from '@/lib/services/message-log.service';

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

export const rescheduleService = {
  /**
   * Cancel an appointment, return visit request to planning pool.
   */
  async cancelAppointment(appointmentId: string, reason?: string): Promise<CancelResult> {
    return prisma.$transaction(async (tx) => {
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

      // 1. Cancel the appointment
      await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason ?? null,
        },
      });

      // 2. Return visit request to planning pool
      await tx.visitRequest.update({
        where: { id: appointment.visitRequestId },
        data: { planningStatus: 'PLANNING_POOL' },
      });

      // 3. Update route run stop to SKIPPED (if linked)
      if (appointment.routeRunId) {
        await tx.routeRunStop.updateMany({
          where: {
            routeRunId: appointment.routeRunId,
            visitRequestId: appointment.visitRequestId,
          },
          data: { stopStatus: 'SKIPPED' },
        });

        // 4. Recalculate route run totals
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

      // 5. Send cancellation acknowledgement
      const customer = appointment.visitRequest.customer;
      const lang = customer.preferredLanguage || 'en';
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
          appointment.visitRequest.enquiryId ?? undefined,
        );
      } else if (customer.preferredChannel === 'WHATSAPP' && customer.mobilePhone && appointment.visitRequest.enquiryId) {
        await messageLogService.logMessage({
          enquiryId: appointment.visitRequest.enquiryId,
          direction: 'OUTBOUND',
          channel: 'WHATSAPP',
          messageText: message,
          sentOrReceivedAt: new Date(),
        });
      }

      return {
        appointmentId,
        cancelled: true,
        returnedToPool: true,
      };
    });
  },

  /**
   * Reschedule an appointment: cancel and return to pool with note.
   */
  async rescheduleAppointment(appointmentId: string, notes?: string): Promise<RescheduleResult> {
    const cancelResult = await this.cancelAppointment(appointmentId, 'Rescheduled');

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
      } else if (customer.preferredChannel === 'WHATSAPP' && customer.mobilePhone && appointment.visitRequest.enquiryId) {
        await messageLogService.logMessage({
          enquiryId: appointment.visitRequest.enquiryId,
          direction: 'OUTBOUND',
          channel: 'WHATSAPP',
          messageText: message,
          sentOrReceivedAt: new Date(),
        });
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
  async markNoShow(appointmentId: string): Promise<void> {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED') {
      throw new Error(`Cannot mark as no-show: appointment is ${appointment.status}`);
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'NO_SHOW' },
    });
  },
};
