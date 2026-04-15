import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  enquiryMessage: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { messageLogService } from '@/lib/services/message-log.service';

describe('messageLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logMessage', () => {
    it('creates a new message record', async () => {
      mockPrisma.enquiryMessage.create.mockResolvedValue({ id: 'msg-1' });

      await messageLogService.logMessage({
        enquiryId: 'enq-1',
        direction: 'INBOUND',
        channel: 'WHATSAPP',
        messageText: 'Hello',
        sentOrReceivedAt: new Date('2024-01-01'),
      });

      expect(mockPrisma.enquiryMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          enquiryId: 'enq-1',
          direction: 'INBOUND',
          channel: 'WHATSAPP',
          messageText: 'Hello',
        }),
      });
    });

    it('deduplicates by externalMessageId', async () => {
      mockPrisma.enquiryMessage.findFirst.mockResolvedValue({ id: 'existing-msg' });

      const result = await messageLogService.logMessage({
        enquiryId: 'enq-1',
        direction: 'INBOUND',
        channel: 'WHATSAPP',
        messageText: 'Hello',
        sentOrReceivedAt: new Date('2024-01-01'),
        externalMessageId: 'ext-123',
      });

      expect(result).toEqual({ id: 'existing-msg' });
      expect(mockPrisma.enquiryMessage.create).not.toHaveBeenCalled();
    });

    it('creates when externalMessageId does not match existing', async () => {
      mockPrisma.enquiryMessage.findFirst.mockResolvedValue(null);
      mockPrisma.enquiryMessage.create.mockResolvedValue({ id: 'new-msg' });

      await messageLogService.logMessage({
        enquiryId: 'enq-1',
        direction: 'OUTBOUND',
        channel: 'EMAIL',
        messageText: 'Reply text',
        sentOrReceivedAt: new Date('2024-01-01'),
        externalMessageId: 'ext-456',
      });

      expect(mockPrisma.enquiryMessage.create).toHaveBeenCalled();
    });
  });

  describe('getMessageHistory', () => {
    it('returns messages ordered by date', async () => {
      const messages = [
        { id: '1', sentOrReceivedAt: new Date('2024-01-01') },
        { id: '2', sentOrReceivedAt: new Date('2024-01-02') },
      ];
      mockPrisma.enquiryMessage.findMany.mockResolvedValue(messages);

      const result = await messageLogService.getMessageHistory('enq-1');

      expect(mockPrisma.enquiryMessage.findMany).toHaveBeenCalledWith({
        where: { enquiryId: 'enq-1' },
        orderBy: { sentOrReceivedAt: 'asc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getMessageCount', () => {
    it('returns message count for enquiry', async () => {
      mockPrisma.enquiryMessage.count.mockResolvedValue(5);

      const count = await messageLogService.getMessageCount('enq-1');
      expect(count).toBe(5);
    });
  });
});
