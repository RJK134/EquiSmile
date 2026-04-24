import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockTransaction,
  mockAppointmentFindUnique,
  mockAppointmentUpdate,
  mockStatusHistoryCreate,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockAppointmentFindUnique: vi.fn(),
  mockAppointmentUpdate: vi.fn(),
  mockStatusHistoryCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    appointment: {
      findUnique: mockAppointmentFindUnique,
      update: mockAppointmentUpdate,
    },
    appointmentStatusHistory: {
      create: mockStatusHistoryCreate,
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
          appointmentStatusHistory: { create: vi.fn() },
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
          appointmentStatusHistory: { create: vi.fn() },
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

    it('records the supplied actor on the status-history row, not "system"', async () => {
      mockAppointmentFindUnique.mockResolvedValue({ id: 'appt1', status: 'CONFIRMED' });
      mockAppointmentUpdate.mockResolvedValue({});

      await rescheduleService.markNoShow('appt1', { actor: 'rjk134' });

      expect(mockStatusHistoryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          appointmentId: 'appt1',
          fromStatus: 'CONFIRMED',
          toStatus: 'NO_SHOW',
          changedBy: 'rjk134',
        }),
      });
    });

    it('falls back to "system" when no actor is supplied', async () => {
      mockAppointmentFindUnique.mockResolvedValue({ id: 'appt1', status: 'CONFIRMED' });
      mockAppointmentUpdate.mockResolvedValue({});

      await rescheduleService.markNoShow('appt1');

      expect(mockStatusHistoryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ changedBy: 'system' }),
      });
    });
  });

  describe('cancelAppointment — outbound sends land post-commit', () => {
    it('dispatches the WhatsApp acknowledgement OUTSIDE the prisma transaction', async () => {
      // Regression: previously the outbound send sat inside
      // prisma.$transaction, so Meta's retry loop (~45s worst case)
      // would blow past Prisma's 5s interactive-tx timeout and roll
      // back the cancellation AFTER the customer had already been
      // messaged. This test fails if the send drifts back inside.
      const sendTextSpy = vi.mocked(
        (await import('@/lib/services/whatsapp.service')).whatsappService.sendTextMessage,
      );
      sendTextSpy.mockClear();

      let sawSendInsideTx = false;
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'appt-tx',
              status: 'PROPOSED',
              visitRequestId: 'vr1',
              routeRunId: null,
              visitRequest: {
                enquiryId: 'e1',
                customer: {
                  fullName: 'Jane',
                  email: null,
                  mobilePhone: '+44700',
                  preferredChannel: 'WHATSAPP',
                  preferredLanguage: 'en',
                },
              },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          visitRequest: { update: vi.fn().mockResolvedValue({}) },
          routeRunStop: { updateMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
          routeRun: { update: vi.fn() },
          appointmentStatusHistory: { create: vi.fn() },
        };
        const result = await fn(tx);
        // If the send had been invoked by the time the tx callback
        // returns, it ran inside the transaction — that's the bug.
        if (sendTextSpy.mock.calls.length > 0) sawSendInsideTx = true;
        return result;
      });

      await rescheduleService.cancelAppointment('appt-tx', 'customer phoned');

      expect(sawSendInsideTx).toBe(false);
      expect(sendTextSpy).toHaveBeenCalledWith(
        '+44700',
        expect.stringContaining('cancelled'),
        'e1',
        'en',
        { operationKey: 'wa-cancel:appt-tx' },
      );
    });

    it('returns success even if the post-commit notification throws unexpectedly', async () => {
      // Regression: the cancel transaction has already committed by
      // the time we try to send the customer ack. If the send path
      // throws (network blip, or a future contributor changing the
      // service signature), the API used to surface a 500 — which
      // would trick a retrying operator into hitting "Cannot cancel
      // appointment with status: CANCELLED" on the next attempt and
      // mask the real outcome. The post-commit block now swallows
      // throws and logs them; the cancellation result is returned.
      const { whatsappService } = await import('@/lib/services/whatsapp.service');
      const sendTextSpy = vi.mocked(whatsappService.sendTextMessage);
      sendTextSpy.mockReset();
      sendTextSpy.mockRejectedValueOnce(new Error('send pipeline crashed'));

      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'appt-throw',
              status: 'PROPOSED',
              visitRequestId: 'vr1',
              routeRunId: null,
              visitRequest: {
                enquiryId: 'e1',
                customer: {
                  fullName: 'Jane',
                  email: null,
                  mobilePhone: '+44700',
                  preferredChannel: 'WHATSAPP',
                  preferredLanguage: 'en',
                },
              },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          visitRequest: { update: vi.fn().mockResolvedValue({}) },
          routeRunStop: { updateMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
          routeRun: { update: vi.fn() },
          appointmentStatusHistory: { create: vi.fn() },
        };
        return fn(tx);
      });

      const result = await rescheduleService.cancelAppointment('appt-throw', 'reason');

      expect(result).toEqual({
        appointmentId: 'appt-throw',
        cancelled: true,
        returnedToPool: true,
      });
      expect(sendTextSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('rescheduleAppointment — does not double-message the customer', () => {
    it('suppresses the cancellation ack and only sends the reschedule ack', async () => {
      // Regression: rescheduleAppointment delegates to cancelAppointment
      // for the DB work. When cancelAppointment was log-only, having it
      // also "send" a cancellation ack was harmless — nothing went out.
      // With real WhatsApp sending, the customer would receive BOTH a
      // "your appointment is cancelled" message AND the intended
      // "cancelled and will be rescheduled" follow-up. The reschedule
      // path now passes { notifyCustomer: false } to collapse that to
      // a single outbound.
      const { whatsappService } = await import('@/lib/services/whatsapp.service');
      const sendTextSpy = vi.mocked(whatsappService.sendTextMessage);
      sendTextSpy.mockClear();

      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'appt-r',
              status: 'CONFIRMED',
              visitRequestId: 'vr1',
              routeRunId: null,
              visitRequest: {
                enquiryId: 'e1',
                customer: {
                  fullName: 'Jane',
                  email: null,
                  mobilePhone: '+44700',
                  preferredChannel: 'WHATSAPP',
                  preferredLanguage: 'en',
                },
              },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          visitRequest: { update: vi.fn().mockResolvedValue({}) },
          routeRunStop: { updateMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
          routeRun: { update: vi.fn() },
          appointmentStatusHistory: { create: vi.fn() },
        };
        return fn(tx);
      });

      mockAppointmentFindUnique.mockResolvedValue({
        visitRequestId: 'vr1',
        visitRequest: {
          enquiryId: 'e1',
          customer: {
            fullName: 'Jane',
            email: null,
            mobilePhone: '+44700',
            preferredChannel: 'WHATSAPP',
            preferredLanguage: 'en',
          },
        },
      });

      await rescheduleService.rescheduleAppointment('appt-r', 'customer asked');

      // Exactly one WhatsApp send, and it's the reschedule ack —
      // identifiable by the operation key.
      expect(sendTextSpy).toHaveBeenCalledTimes(1);
      const [, , , , options] = sendTextSpy.mock.calls[0];
      expect(options).toEqual({ operationKey: 'wa-reschedule:appt-r' });
    });
  });

  describe('cancelAppointment actor attribution', () => {
    it('threads the supplied actor into the status-history row', async () => {
      const statusHistoryCreateSpy = vi.fn();
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          appointment: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'appt1',
              status: 'PROPOSED',
              visitRequestId: 'vr1',
              routeRunId: null,
              visitRequest: {
                enquiryId: 'e1',
                customer: {
                  fullName: 'John',
                  email: 'j@example.com',
                  mobilePhone: null,
                  preferredChannel: 'EMAIL',
                  preferredLanguage: 'en',
                },
              },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          visitRequest: { update: vi.fn().mockResolvedValue({}) },
          routeRunStop: { updateMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
          routeRun: { update: vi.fn() },
          appointmentStatusHistory: { create: statusHistoryCreateSpy },
        };
        return fn(tx);
      });

      await rescheduleService.cancelAppointment('appt1', 'no longer needed', {
        actor: 'vet-1',
      });

      expect(statusHistoryCreateSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changedBy: 'vet-1',
          reason: 'no longer needed',
          toStatus: 'CANCELLED',
        }),
      });
    });
  });
});
