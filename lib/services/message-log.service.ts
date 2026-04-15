import { prisma } from '@/lib/prisma';
import type { Channel, MessageDirection } from '@prisma/client';

export interface LogMessageInput {
  enquiryId: string;
  direction: MessageDirection;
  channel: Channel;
  messageText: string;
  sentOrReceivedAt: Date;
  externalMessageId?: string;
}

/**
 * Centralised service for logging all inbound and outbound messages.
 */
export const messageLogService = {
  /**
   * Create an enquiry_message record.
   * Deduplicates by externalMessageId when provided.
   */
  async logMessage(input: LogMessageInput) {
    // Deduplicate if external message ID is provided
    if (input.externalMessageId) {
      const existing = await prisma.enquiryMessage.findFirst({
        where: { externalMessageId: input.externalMessageId },
      });
      if (existing) {
        return existing;
      }
    }

    return prisma.enquiryMessage.create({
      data: {
        enquiryId: input.enquiryId,
        direction: input.direction,
        channel: input.channel,
        messageText: input.messageText,
        sentOrReceivedAt: input.sentOrReceivedAt,
        externalMessageId: input.externalMessageId || null,
      },
    });
  },

  /**
   * Get message history for an enquiry, ordered chronologically.
   */
  async getMessageHistory(enquiryId: string) {
    return prisma.enquiryMessage.findMany({
      where: { enquiryId },
      orderBy: { sentOrReceivedAt: 'asc' },
    });
  },

  /**
   * Get message count for an enquiry.
   */
  async getMessageCount(enquiryId: string) {
    return prisma.enquiryMessage.count({
      where: { enquiryId },
    });
  },
};
