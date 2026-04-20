import { prisma } from '@/lib/prisma';
import type { AppointmentResponseKind, AppointmentStatus, ConfirmationChannel } from '@prisma/client';

/**
 * Phase 14 PR D — appointment auditability (AMBER-10, 11, 13).
 *
 * Appointments accumulate history across three dimensions:
 *  - Confirmation dispatch attempts (outbound)
 *  - Customer responses (inbound)
 *  - Status transitions (domain state)
 *
 * All writes are best-effort: a failure to record MUST NOT break the
 * primary request. Use this service alongside the main booking /
 * confirmation services.
 */

export interface LogConfirmationDispatchInput {
  appointmentId: string;
  channel: ConfirmationChannel;
  success: boolean;
  externalMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: Date;
}

export interface LogAppointmentResponseInput {
  appointmentId: string;
  kind: AppointmentResponseKind;
  channel: ConfirmationChannel;
  rawText?: string | null;
  enquiryMessageId?: string | null;
  receivedAt?: Date;
}

export interface LogStatusChangeInput {
  appointmentId: string;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus;
  changedBy: string;
  reason?: string | null;
  changedAt?: Date;
}

export const appointmentAuditService = {
  async logConfirmationDispatch(input: LogConfirmationDispatchInput): Promise<void> {
    try {
      await prisma.confirmationDispatch.create({
        data: {
          appointmentId: input.appointmentId,
          channel: input.channel,
          success: input.success,
          externalMessageId: input.externalMessageId ?? null,
          errorMessage: input.errorMessage ?? null,
          ...(input.sentAt ? { sentAt: input.sentAt } : {}),
        },
      });
    } catch (error) {
      console.warn('[appointment-audit] confirmation-dispatch log failed', {
        appointmentId: input.appointmentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async logResponse(input: LogAppointmentResponseInput): Promise<void> {
    try {
      await prisma.appointmentResponse.create({
        data: {
          appointmentId: input.appointmentId,
          kind: input.kind,
          channel: input.channel,
          rawText: input.rawText ?? null,
          enquiryMessageId: input.enquiryMessageId ?? null,
          ...(input.receivedAt ? { receivedAt: input.receivedAt } : {}),
        },
      });
    } catch (error) {
      console.warn('[appointment-audit] response log failed', {
        appointmentId: input.appointmentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async logStatusChange(input: LogStatusChangeInput): Promise<void> {
    if (input.fromStatus === input.toStatus) return;
    try {
      await prisma.appointmentStatusHistory.create({
        data: {
          appointmentId: input.appointmentId,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          changedBy: input.changedBy,
          reason: input.reason ?? null,
          ...(input.changedAt ? { changedAt: input.changedAt } : {}),
        },
      });
    } catch (error) {
      console.warn('[appointment-audit] status-change log failed', {
        appointmentId: input.appointmentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async confirmationDispatches(appointmentId: string) {
    return prisma.confirmationDispatch.findMany({
      where: { appointmentId },
      orderBy: { sentAt: 'desc' },
    });
  },

  async responses(appointmentId: string) {
    return prisma.appointmentResponse.findMany({
      where: { appointmentId },
      orderBy: { receivedAt: 'desc' },
    });
  },

  async statusHistory(appointmentId: string) {
    return prisma.appointmentStatusHistory.findMany({
      where: { appointmentId },
      orderBy: { changedAt: 'asc' },
    });
  },
};
