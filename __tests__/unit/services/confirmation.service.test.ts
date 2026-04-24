import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/services/email.service', () => ({
  emailService: {
    sendBrandedEmail: vi.fn(),
  },
}));

vi.mock('@/lib/services/whatsapp.service', () => ({
  whatsappService: {
    sendTextMessage: vi.fn().mockResolvedValue({ messageId: 'wa-1', success: true }),
  },
}));

const logConfirmationDispatchMock = vi.hoisted(() => vi.fn());
const logStatusChangeMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/appointment-audit.service', () => ({
  appointmentAuditService: {
    logConfirmationDispatch: logConfirmationDispatchMock,
    logStatusChange: logStatusChangeMock,
  },
}));

import { confirmationService } from '@/lib/services/confirmation.service';
import { whatsappService } from '@/lib/services/whatsapp.service';
import { prisma } from '@/lib/prisma';

describe('confirmationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the atomic compare-and-swap succeeds — simulating the
    // common case where no concurrent writer moved the row out of
    // PROPOSED during the send. Individual tests can override to
    // simulate the race.
    (prisma.appointment.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
  });

  describe('buildConfirmationMessage', () => {
    const baseAppointment = {
      id: 'appt1',
      appointmentStart: new Date('2026-05-01T09:00:00Z'),
      appointmentEnd: new Date('2026-05-01T10:00:00Z'),
      visitRequest: {
        id: 'vr1',
        horseCount: 3,
        enquiryId: null,
        customer: {
          id: 'c1',
          fullName: 'John Smith',
          mobilePhone: '+447700900000',
          email: 'john@test.com',
          preferredChannel: 'EMAIL' as const,
          preferredLanguage: 'en',
        },
        yard: {
          id: 'y1',
          yardName: 'Green Meadows',
          addressLine1: '123 Farm Lane',
          town: 'Horsham',
          postcode: 'RH12 1AB',
        },
      },
    };

    it('generates English confirmation message', () => {
      const message = confirmationService.buildConfirmationMessage(baseAppointment);

      expect(message).toContain('Hi John Smith');
      expect(message).toContain('Your equine dental appointment has been confirmed');
      expect(message).toContain('Green Meadows');
      expect(message).toContain('Horses: 3');
      expect(message).toContain('starved for at least 4 hours');
      expect(message).toContain('EquiSmile');
    });

    it('generates French confirmation message', () => {
      const frAppointment = {
        ...baseAppointment,
        visitRequest: {
          ...baseAppointment.visitRequest,
          customer: {
            ...baseAppointment.visitRequest.customer,
            fullName: 'Jean Dupont',
            preferredLanguage: 'fr',
          },
        },
      };

      const message = confirmationService.buildConfirmationMessage(frAppointment);

      expect(message).toContain('Bonjour Jean Dupont');
      expect(message).toContain('rendez-vous de soins dentaires');
      expect(message).toContain('Green Meadows');
      expect(message).toContain('Chevaux : 3');
      expect(message).toContain('à jeun depuis au moins 4 heures');
      expect(message).toContain('EquiSmile');
    });

    it('defaults to 1 horse when horseCount is null', () => {
      const noHorseCount = {
        ...baseAppointment,
        visitRequest: {
          ...baseAppointment.visitRequest,
          horseCount: null,
        },
      };

      const message = confirmationService.buildConfirmationMessage(noHorseCount);
      expect(message).toContain('Horses: 1');
    });
  });

  describe('sendConfirmation — real outbound + audit trail', () => {
    const whatsappAppointment = {
      id: 'appt-wa',
      status: 'PROPOSED' as const,
      appointmentStart: new Date('2026-05-01T09:00:00Z'),
      appointmentEnd: new Date('2026-05-01T10:00:00Z'),
      visitRequest: {
        id: 'vr-wa',
        horseCount: 2,
        enquiryId: 'enq-wa',
        customer: {
          id: 'c-wa',
          fullName: 'Jane Rider',
          mobilePhone: '+44700900000',
          email: null,
          preferredChannel: 'WHATSAPP' as const,
          preferredLanguage: 'en',
        },
        yard: {
          id: 'y-wa',
          yardName: 'Hillside',
          addressLine1: '1 Farm Ln',
          town: 'Horsham',
          postcode: 'RH1 1AA',
        },
      },
    };

    it('calls the real WhatsApp service with a deterministic operationKey (not a log-only path)', async () => {
      (prisma.appointment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(whatsappAppointment);
      (prisma.appointment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await confirmationService.sendConfirmation('appt-wa', { actor: 'rjk134' });

      expect(result.sent).toBe(true);
      expect(whatsappService.sendTextMessage).toHaveBeenCalledWith(
        '+44700900000',
        expect.stringContaining('Your equine dental appointment has been confirmed'),
        'enq-wa',
        'en',
        { operationKey: 'wa-confirmation:appt-wa' },
      );
    });

    it('logs a ConfirmationDispatch row capturing channel + success + external message id', async () => {
      (prisma.appointment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(whatsappAppointment);
      (prisma.appointment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await confirmationService.sendConfirmation('appt-wa', { actor: 'rjk134' });

      expect(logConfirmationDispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 'appt-wa',
          channel: 'WHATSAPP',
          success: true,
          externalMessageId: 'wa-1',
        }),
      );
    });

    it('records the PROPOSED → CONFIRMED status transition with the real actor, not "system"', async () => {
      (prisma.appointment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(whatsappAppointment);
      (prisma.appointment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await confirmationService.sendConfirmation('appt-wa', { actor: 'rjk134' });

      expect(logStatusChangeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 'appt-wa',
          fromStatus: 'PROPOSED',
          toStatus: 'CONFIRMED',
          changedBy: 'rjk134',
        }),
      );
    });

    it('logs the dispatch channel as a ConfirmationChannel enum value even when customer preferredChannel is PHONE', async () => {
      // The audit write expects a ConfirmationChannel enum, not the
      // Customer.preferredChannel enum. They share values today but
      // they are distinct Prisma types — the service routes through a
      // typed mapper so the two can diverge later without silently
      // writing a bad value into the ConfirmationDispatch column.
      (prisma.appointment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...whatsappAppointment,
        visitRequest: {
          ...whatsappAppointment.visitRequest,
          customer: {
            ...whatsappAppointment.visitRequest.customer,
            preferredChannel: 'PHONE' as const,
            email: null,
            mobilePhone: null,
          },
        },
      });
      (prisma.appointment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await confirmationService.sendConfirmation('appt-wa', { actor: 'rjk134' });

      expect(logConfirmationDispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'PHONE', success: false }),
      );
    });

    it('does not re-log a status transition when the appointment is already CONFIRMED (resend)', async () => {
      (prisma.appointment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...whatsappAppointment,
        status: 'CONFIRMED',
      });
      (prisma.appointment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await confirmationService.sendConfirmation('appt-wa', { actor: 'rjk134' });

      expect(logStatusChangeMock).not.toHaveBeenCalled();
      // Dispatch is still recorded — resend audit trail.
      expect(logConfirmationDispatchMock).toHaveBeenCalledTimes(1);
    });

    it('does NOT overwrite a CANCELLED state set concurrently during the send window', async () => {
      // Regression: the old code read `appointment.status` up front
      // and then wrote `status: 'CONFIRMED'` unconditionally after the
      // (several-second) WhatsApp send. If a sibling request ran
      // cancelAppointment during that window, the confirmation path
      // would silently un-cancel the booking. The update is now an
      // atomic updateMany with a status: 'PROPOSED' WHERE clause —
      // simulate the race by returning count: 0 and assert no
      // status-change row is logged.
      (prisma.appointment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(whatsappAppointment);
      (prisma.appointment.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

      const result = await confirmationService.sendConfirmation('appt-wa', { actor: 'rjk134' });

      expect(result.sent).toBe(true);
      // The compare-and-swap went to the typed path...
      expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
        where: { id: 'appt-wa', status: 'PROPOSED' },
        data: expect.objectContaining({ status: 'CONFIRMED' }),
      });
      // ...but because count was 0, no status-history row was written.
      expect(logStatusChangeMock).not.toHaveBeenCalled();
      // The dispatch audit row still lands so the send itself is
      // recorded.
      expect(logConfirmationDispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: 'appt-wa', success: true }),
      );
    });

    it('still writes a ConfirmationDispatch(success=false) row when the send throws unexpectedly', async () => {
      // AMBER-10 guarantees every dispatch attempt (success OR failure)
      // lands in the audit log. A previous version of the code would
      // let an exception from whatsappService escape, skipping both the
      // status update AND the audit write. The send is now try-wrapped
      // so the audit row is always written.
      (prisma.appointment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(whatsappAppointment);
      (prisma.appointment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      vi.mocked(whatsappService.sendTextMessage).mockRejectedValueOnce(
        new Error('send pipeline exploded'),
      );

      const result = await confirmationService.sendConfirmation('appt-wa', { actor: 'rjk134' });

      expect(result.sent).toBe(false);
      expect(logConfirmationDispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 'appt-wa',
          channel: 'WHATSAPP',
          success: false,
          errorMessage: 'send pipeline exploded',
        }),
      );
      // No spurious status flip when the send fails.
      expect(logStatusChangeMock).not.toHaveBeenCalled();
    });
  });
});
