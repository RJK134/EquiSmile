import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
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
  });
});
