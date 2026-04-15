import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
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

vi.mock('@/lib/repositories/appointment.repository', () => ({
  appointmentRepository: {
    findDueForReminder: vi.fn().mockResolvedValue([]),
  },
}));

import { reminderService } from '@/lib/services/reminder.service';

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
      const results = await reminderService.checkAndSendReminders();
      expect(results).toEqual([]);
    });
  });
});
