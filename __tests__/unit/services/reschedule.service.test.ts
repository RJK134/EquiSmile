import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransaction, mockAppointmentFindUnique, mockAppointmentUpdate } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockAppointmentFindUnique: vi.fn(),
  mockAppointmentUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    appointment: {
      findUnique: mockAppointmentFindUnique,
      update: mockAppointmentUpdate,
    },
  },
}));

vi.mock('@/lib/services/email.service', () => ({
  emailService: {
    sendBrandedEmail: vi.fn(),
  },
}));

vi.mock('@/lib/services/message-log.service', () => ({
  messageLogService: {
    logMessage: vi.fn(),
  },
}));

import { rescheduleService } from '@/lib/services/reschedule.service';

describe('rescheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseCustomerIntent', () => {
    it('detects English cancel keywords', () => {
      expect(rescheduleService.parseCustomerIntent('I need to cancel my appointment'))
        .toEqual({ intent: 'cancel', confidence: 'high' });

      expect(rescheduleService.parseCustomerIntent("I can't make it tomorrow"))
        .toEqual({ intent: 'cancel', confidence: 'high' });
    });

    it('detects French cancel keywords', () => {
      expect(rescheduleService.parseCustomerIntent('Je voudrais annuler le rendez-vous'))
        .toEqual({ intent: 'cancel', confidence: 'high' });

      expect(rescheduleService.parseCustomerIntent('Je ne peux pas venir'))
        .toEqual({ intent: 'cancel', confidence: 'high' });
    });

    it('detects English reschedule keywords', () => {
      expect(rescheduleService.parseCustomerIntent('Can I reschedule to next week?'))
        .toEqual({ intent: 'reschedule', confidence: 'high' });

      expect(rescheduleService.parseCustomerIntent('I need to change date'))
        .toEqual({ intent: 'reschedule', confidence: 'high' });
    });

    it('detects French reschedule keywords', () => {
      expect(rescheduleService.parseCustomerIntent('Peut-on reporter à la semaine prochaine?'))
        .toEqual({ intent: 'reschedule', confidence: 'high' });

      expect(rescheduleService.parseCustomerIntent('Je voudrais changer la date'))
        .toEqual({ intent: 'reschedule', confidence: 'high' });
    });

    it('returns none for unrelated messages', () => {
      expect(rescheduleService.parseCustomerIntent('Thanks for the appointment'))
        .toEqual({ intent: 'none', confidence: 'low' });

      expect(rescheduleService.parseCustomerIntent('What time should I prepare the horses?'))
        .toEqual({ intent: 'none', confidence: 'low' });
    });
  });

  describe('cancelAppointment', () => {
    it('throws if appointment not found', async () => {
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
          visitRequest: { update: vi.fn() },
          routeRunStop: { updateMany: vi.fn(), count: vi.fn() },
          routeRun: { update: vi.fn() },
        };
        return fn(tx);
      });

      await expect(rescheduleService.cancelAppointment('appt1'))
        .rejects.toThrow('Appointment not found');
    });

    it('throws if appointment is already cancelled', async () => {
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'appt1',
              status: 'CANCELLED',
              visitRequest: {
                enquiryId: null,
                customer: { fullName: 'John', preferredLanguage: 'en', preferredChannel: 'EMAIL', email: 'john@test.com', mobilePhone: null },
              },
            }),
            update: vi.fn(),
          },
          visitRequest: { update: vi.fn() },
          routeRunStop: { updateMany: vi.fn(), count: vi.fn() },
          routeRun: { update: vi.fn() },
        };
        return fn(tx);
      });

      await expect(rescheduleService.cancelAppointment('appt1'))
        .rejects.toThrow('Cannot cancel appointment with status: CANCELLED');
    });
  });

  describe('markNoShow', () => {
    it('throws if appointment not found', async () => {
      mockAppointmentFindUnique.mockResolvedValue(null);

      await expect(rescheduleService.markNoShow('appt1'))
        .rejects.toThrow('Appointment not found');
    });

    it('throws if appointment is completed', async () => {
      mockAppointmentFindUnique.mockResolvedValue({
        id: 'appt1',
        status: 'COMPLETED',
      });

      await expect(rescheduleService.markNoShow('appt1'))
        .rejects.toThrow('Cannot mark as no-show');
    });

    it('marks appointment as NO_SHOW', async () => {
      mockAppointmentFindUnique.mockResolvedValue({
        id: 'appt1',
        status: 'CONFIRMED',
      });
      mockAppointmentUpdate.mockResolvedValue({});

      await rescheduleService.markNoShow('appt1');

      expect(mockAppointmentUpdate).toHaveBeenCalledWith({
        where: { id: 'appt1' },
        data: { status: 'NO_SHOW' },
      });
    });
  });
});
