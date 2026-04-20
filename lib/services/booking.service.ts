/**
 * Phase 6.1 — Booking Service
 *
 * Converts approved route proposals into confirmed appointments.
 * Uses Prisma transactions for atomic booking operations.
 */

import { prisma } from '@/lib/prisma';
import type { ConfirmationChannel } from '@prisma/client';

interface BookingResult {
  routeRunId: string;
  appointmentIds: string[];
  appointmentCount: number;
}

function mapPreferredChannel(channel: string): ConfirmationChannel {
  if (channel === 'WHATSAPP') return 'WHATSAPP';
  if (channel === 'EMAIL') return 'EMAIL';
  return 'PHONE';
}

export const bookingService = {
  /**
   * Convert an approved route run into appointments for all stops.
   * Atomic: all stops booked or none.
   */
  async bookRouteRun(routeRunId: string): Promise<BookingResult> {
    return prisma.$transaction(async (tx) => {
      // 1. Load route run with stops
      const routeRun = await tx.routeRun.findUnique({
        where: { id: routeRunId },
        include: {
          stops: {
            orderBy: { sequenceNo: 'asc' },
            include: {
              visitRequest: {
                include: {
                  customer: {
                    select: { preferredChannel: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!routeRun) {
        throw new Error('Route run not found');
      }

      if (routeRun.status !== 'APPROVED') {
        throw new Error(
          `Route run must be APPROVED to book. Current status: ${routeRun.status}`
        );
      }

      const appointmentIds: string[] = [];

      // 2. For each stop, create appointment and update statuses
      for (const stop of routeRun.stops) {
        if (!stop.visitRequestId || !stop.visitRequest) continue;

        const serviceMinutes = stop.serviceMinutes ?? 30;
        const arrival = stop.plannedArrival ?? routeRun.startTime ?? new Date();
        const end = new Date(arrival.getTime() + serviceMinutes * 60 * 1000);

        const channelStr = stop.visitRequest.customer?.preferredChannel ?? 'WHATSAPP';
        const confirmationChannel = mapPreferredChannel(channelStr);

        // 2a. Create appointment
        const appointment = await tx.appointment.create({
          data: {
            visitRequestId: stop.visitRequestId,
            routeRunId,
            appointmentStart: arrival,
            appointmentEnd: end,
            status: 'PROPOSED',
            confirmationChannel,
          },
        });
        appointmentIds.push(appointment.id);

        // AMBER-13 — record the initial status.
        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: appointment.id,
            fromStatus: null,
            toStatus: 'PROPOSED',
            changedBy: 'system',
            reason: `created from route-run ${routeRunId}`,
          },
        });

        // 2b. Update visit request: PROPOSED → BOOKED
        await tx.visitRequest.update({
          where: { id: stop.visitRequestId },
          data: { planningStatus: 'BOOKED' },
        });

        // 2c. Update stop status: PLANNED → CONFIRMED
        await tx.routeRunStop.update({
          where: { id: stop.id },
          data: { stopStatus: 'CONFIRMED' },
        });
      }

      // 3. Update route run: APPROVED → BOOKED
      await tx.routeRun.update({
        where: { id: routeRunId },
        data: { status: 'BOOKED' },
      });

      return {
        routeRunId,
        appointmentIds,
        appointmentCount: appointmentIds.length,
      };
    });
  },
};
