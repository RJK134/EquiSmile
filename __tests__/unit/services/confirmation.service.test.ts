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

vi.mock('@/lib/services/message-log.service', () => ({
  messageLogService: {
    logMessage: vi.fn(),
  },
}));

import { confirmationService } from '@/lib/services/confirmation.service';

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
          preferredChannel: 'EMAIL',
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
});
