/**
 * Phase 6.5 — Visit Outcome Service
 *
 * Handles appointment completion and visit outcome recording,
 * including follow-up creation and horse dental due date updates.
 */

import { prisma } from '@/lib/prisma';
import type { ActorContext } from '@/lib/types/actor';

export interface CompleteAppointmentInput {
  notes?: string;
  followUpRequired?: boolean;
  followUpDueDate?: string;
  nextDentalDueDate?: string;
}

interface CompleteResult {
  appointmentId: string;
  visitOutcomeId: string;
  followUpVisitRequestId?: string;
}

export const visitOutcomeService = {
  /**
   * Mark an appointment as completed and record visit outcome.
   */
  async completeAppointment(
    appointmentId: string,
    input: CompleteAppointmentInput,
    context: ActorContext = {},
  ): Promise<CompleteResult> {
    const actor = context.actor?.trim() || 'system';
    return prisma.$transaction(async (tx) => {
      // 1. Load appointment
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          visitRequest: {
            include: {
              customer: { select: { id: true } },
              yard: { select: { id: true } },
            },
          },
          visitOutcome: true,
        },
      });

      if (!appointment) {
        throw new Error('Appointment not found');
      }

      if (appointment.status === 'COMPLETED') {
        throw new Error('Appointment is already completed');
      }

      if (appointment.status === 'CANCELLED') {
        throw new Error('Cannot complete a cancelled appointment');
      }

      // 2. Create VisitOutcome
      const visitOutcome = await tx.visitOutcome.create({
        data: {
          appointmentId,
          completedAt: new Date(),
          notes: input.notes ?? null,
          followUpRequired: input.followUpRequired ?? false,
          followUpDueDate: input.followUpDueDate ? new Date(input.followUpDueDate) : null,
          nextDentalDueDate: input.nextDentalDueDate ? new Date(input.nextDentalDueDate) : null,
        },
      });

      // 3. Update appointment status
      const priorStatus = appointment.status;
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' },
      });
      // AMBER-13 — status history for the CONFIRMED|PROPOSED → COMPLETED transition.
      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId,
          fromStatus: priorStatus,
          toStatus: 'COMPLETED',
          changedBy: actor,
        },
      });

      // 4. Update visit request planning status
      await tx.visitRequest.update({
        where: { id: appointment.visitRequestId },
        data: { planningStatus: 'COMPLETED' },
      });

      // 5. Update route run stop if linked
      if (appointment.routeRunId) {
        await tx.routeRunStop.updateMany({
          where: {
            routeRunId: appointment.routeRunId,
            visitRequestId: appointment.visitRequestId,
          },
          data: { stopStatus: 'COMPLETED' },
        });
      }

      let followUpVisitRequestId: string | undefined;

      // 6. If follow-up required, create new visit request
      if (input.followUpRequired) {
        const followUp = await tx.visitRequest.create({
          data: {
            customerId: appointment.visitRequest.customer.id,
            yardId: appointment.visitRequest.yard?.id,
            requestType: 'FOLLOW_UP',
            urgencyLevel: 'ROUTINE',
            clinicalFlags: [],
            specificHorses: [],
            preferredDays: [],
            planningStatus: 'PLANNING_POOL',
            earliestBookDate: input.followUpDueDate ? new Date(input.followUpDueDate) : null,
          },
        });
        followUpVisitRequestId = followUp.id;
      }

      // 7. Update horse dental due dates if provided
      if (input.nextDentalDueDate) {
        const nextDate = new Date(input.nextDentalDueDate);
        await tx.horse.updateMany({
          where: {
            customerId: appointment.visitRequest.customer.id,
            primaryYardId: appointment.visitRequest.yard?.id,
          },
          data: { dentalDueDate: nextDate },
        });
      }

      return {
        appointmentId,
        visitOutcomeId: visitOutcome.id,
        followUpVisitRequestId,
      };
    });
  },
};
