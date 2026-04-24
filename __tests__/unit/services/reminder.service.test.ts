import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      update: vi.fn().mockResolvedValue({}),
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

const findDueForReminderMock = vi.hoisted(() =>
  vi.fn<(type: '24h' | '2h') => Promise<unknown[]>>().mockResolvedValue([]),
);
vi.mock('@/lib/repositories/appointment.repository', () => ({
  appointmentRepository: {
    findDueForReminder: findDueForReminderMock,
  },
}));

import { reminderService } from '@/lib/services/reminder.service';
import { whatsappService } from '@/lib/services/whatsapp.service';
import { prisma } from '@/lib/prisma';

describe('reminderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildReminder24h', () => {
    it('builds English 24h reminder', () => {
      const message = reminderService.buildReminder24h('John', '09:00', 'Green Meadows', 'en');
      expect(message).toContain('Hi John');
      expect(message).toContain('tomorrow at 09:00');
      expect(message).toContain('Green Meadows');
      expect(message).toContain('starved for 4 hours');
    });

    it('builds French 24h reminder', () => {
      const message = reminderService.buildReminder24h('Jean', '09:00', 'Pré Vert', 'fr');
      expect(message).toContain('Bonjour Jean');
      expect(message).toContain('demain à 09:00');
      expect(message).toContain('Pré Vert');
      expect(message).toContain('à jeun depuis 4 heures');
    });
  });

  describe('buildReminder2h', () => {
    it('builds English 2h reminder', () => {
      const message = reminderService.buildReminder2h('John', '14:00', 'Green Meadows', 'en');
      expect(message).toContain('Hi John');
      expect(message).toContain('in 2 hours at 14:00');
      expect(message).toContain('Green Meadows');
    });

    it('builds French 2h reminder', () => {
      const message = reminderService.buildReminder2h('Jean', '14:00', 'Pré Vert', 'fr');
      expect(message).toContain('Bonjour Jean');
      expect(message).toContain('dans 2 heures à 14:00');
      expect(message).toContain('Pré Vert');
    });
  });

  describe('checkAndSendReminders', () => {
    it('returns empty array when no reminders are due', async () => {
      findDueForReminderMock.mockResolvedValue([]);
      const results = await reminderService.checkAndSendReminders();
      expect(results).toEqual([]);
    });
  });

  describe('sendReminder — real outbound (not log-only)', () => {
    const whatsappAppt = {
      id: 'appt-r1',
      appointmentStart: new Date('2026-05-10T09:00:00Z'),
      visitRequest: {
        enquiryId: 'enq-r1',
        customer: {
          fullName: 'Jane',
          mobilePhone: '+44700900111',
          email: null,
          preferredChannel: 'WHATSAPP',
          preferredLanguage: 'en',
        },
        yard: { yardName: 'Hillside' },
      },
    };

    it('calls whatsappService with a deterministic operationKey per reminder type', async () => {
      (prisma.appointment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await reminderService.sendReminder(whatsappAppt as never, '24h');

      expect(whatsappService.sendTextMessage).toHaveBeenCalledWith(
        '+44700900111',
        expect.stringContaining('tomorrow'),
        'enq-r1',
        'en',
        { operationKey: 'wa-reminder-24h:appt-r1' },
      );
    });

    it('stamps the 2h reminder column after a successful 2h send', async () => {
      const updateSpy = vi.fn().mockResolvedValue({});
      (prisma.appointment.update as ReturnType<typeof vi.fn>).mockImplementation(updateSpy);

      await reminderService.sendReminder(whatsappAppt as never, '2h');

      expect(whatsappService.sendTextMessage).toHaveBeenCalledWith(
        '+44700900111',
        expect.stringContaining('in 2 hours'),
        'enq-r1',
        'en',
        { operationKey: 'wa-reminder-2h:appt-r1' },
      );
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'appt-r1' },
        data: expect.objectContaining({ reminderSentAt2h: expect.any(Date) }),
      });
    });
  });
});
