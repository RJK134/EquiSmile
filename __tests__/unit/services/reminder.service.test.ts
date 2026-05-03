import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      update: vi.fn().mockResolvedValue({}),
    },
    horse: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    invoice: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/lib/services/email.service', () => ({
  emailService: {
    sendBrandedEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'em-1' }),
  },
}));

vi.mock('@/lib/services/whatsapp.service', () => ({
  whatsappService: {
    sendTextMessage: vi.fn().mockResolvedValue({ messageId: 'wa-1', success: true }),
  },
}));

vi.mock('@/lib/services/audit-log.service', () => ({
  auditLogService: {
    record: vi.fn().mockResolvedValue(undefined),
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
import { auditLogService } from '@/lib/services/audit-log.service';
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

  // Phase A — three new customer-facing dispatches.

  describe('dispatchDentalDueReminders (G-3a)', () => {
    const horseDueIn14d = {
      id: 'horse-1',
      horseName: 'Bella',
      dentalDueDate: new Date('2026-05-17T00:00:00Z'),
      customer: {
        fullName: 'Marie Dupont',
        mobilePhone: '+41799001234',
        email: 'marie@example.test',
        preferredChannel: 'WHATSAPP',
        preferredLanguage: 'fr',
      },
    };

    it('sends a WhatsApp reminder for a horse due within 30 days', async () => {
      (prisma.horse.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([horseDueIn14d]);
      (prisma.auditLog.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const results = await reminderService.dispatchDentalDueReminders(new Date('2026-05-03T00:00:00Z'));

      expect(results).toHaveLength(1);
      expect(results[0].sent).toBe(true);
      expect(results[0].channel).toBe('WHATSAPP');
      expect(whatsappService.sendTextMessage).toHaveBeenCalledWith(
        '+41799001234',
        expect.stringContaining('Bella'),
        undefined,
        'fr',
        { operationKey: 'dental-horse-1-2026-05-03' },
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DENTAL_REMINDER_SENT',
          entityType: 'Horse',
          entityId: 'horse-1',
        }),
      );
    });

    it('skips a horse with a recent dental reminder in AuditLog (debounce)', async () => {
      (prisma.horse.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([horseDueIn14d]);
      (prisma.auditLog.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'recent-log' });

      const results = await reminderService.dispatchDentalDueReminders(new Date('2026-05-03T00:00:00Z'));

      expect(results).toHaveLength(0);
      expect(whatsappService.sendTextMessage).not.toHaveBeenCalled();
    });

    it('returns empty when no horses are due', async () => {
      (prisma.horse.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const results = await reminderService.dispatchDentalDueReminders();
      expect(results).toEqual([]);
    });
  });

  describe('dispatchVaccinationDueReminders (G-3b)', () => {
    const horseVaccineDue = {
      id: 'horse-2',
      horseName: 'Thunder',
      vaccinationDueDate: new Date('2026-05-10T00:00:00Z'),
      customer: {
        fullName: 'Marie Dupont',
        mobilePhone: '+41799001234',
        email: null,
        preferredChannel: 'WHATSAPP',
        preferredLanguage: 'en',
      },
    };

    it('sends a vaccination reminder via WhatsApp', async () => {
      (prisma.horse.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([horseVaccineDue]);

      const results = await reminderService.dispatchVaccinationDueReminders(new Date('2026-05-03T00:00:00Z'));

      expect(results).toHaveLength(1);
      expect(results[0].sent).toBe(true);
      expect(whatsappService.sendTextMessage).toHaveBeenCalledWith(
        '+41799001234',
        expect.stringContaining('Thunder'),
        undefined,
        'en',
        { operationKey: 'vaccine-horse-2-2026-05-03' },
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VACCINATION_REMINDER_SENT' }),
      );
    });

    it('respects the AuditLog-based debounce', async () => {
      (prisma.horse.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([horseVaccineDue]);
      (prisma.auditLog.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'recent' });

      const results = await reminderService.dispatchVaccinationDueReminders();

      expect(results).toHaveLength(0);
    });
  });

  describe('dispatchOverdueInvoiceReminders (G-3c)', () => {
    const overdueInvoice = {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0042',
      total: { toString: () => '480.00' },
      currency: 'CHF',
      dueAt: new Date('2026-03-10T00:00:00Z'), // 54d before 'now' anchor
      lastReminderSentAt: null,
      customer: {
        fullName: 'Pierre Rochat',
        mobilePhone: '+41799001235',
        email: 'pierre@example.test',
        preferredChannel: 'EMAIL',
        preferredLanguage: 'fr',
      },
    };

    it('forces WhatsApp channel even when customer prefers email', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([overdueInvoice]);

      const results = await reminderService.dispatchOverdueInvoiceReminders(new Date('2026-05-03T00:00:00Z'));

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('WHATSAPP');
      expect(whatsappService.sendTextMessage).toHaveBeenCalledWith(
        '+41799001235',
        expect.stringContaining('INV-2026-0042'),
        undefined,
        'fr',
        { operationKey: 'invoice-overdue-inv-1-2026-05-03' },
      );
    });

    it('updates lastReminderSentAt after a successful send', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([overdueInvoice]);

      await reminderService.dispatchOverdueInvoiceReminders(new Date('2026-05-03T00:00:00Z'));

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { lastReminderSentAt: expect.any(Date) },
      });
    });

    it('falls back to email when no mobile phone is on file', async () => {
      const noPhone = {
        ...overdueInvoice,
        customer: { ...overdueInvoice.customer, mobilePhone: null },
      };
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([noPhone]);

      const results = await reminderService.dispatchOverdueInvoiceReminders();

      expect(results[0].channel).toBe('EMAIL');
    });

    it('returns empty when no invoices match the cutoff', async () => {
      (prisma.invoice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const results = await reminderService.dispatchOverdueInvoiceReminders();
      expect(results).toEqual([]);
    });
  });
});
