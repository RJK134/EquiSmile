import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHasBeenProcessed, mockMarkAsProcessed, mockWithRetry, mockLogMessage } = vi.hoisted(
  () => ({
    mockHasBeenProcessed: vi.fn(),
    mockMarkAsProcessed: vi.fn(),
    mockWithRetry: vi.fn(),
    mockLogMessage: vi.fn(),
  }),
);

vi.mock('@/lib/env', () => ({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
    WHATSAPP_ACCESS_TOKEN: 'access-token',
    WHATSAPP_API_TOKEN: '',
  },
}));

vi.mock('@/lib/services/message-log.service', () => ({
  messageLogService: {
    logMessage: mockLogMessage,
  },
}));

vi.mock('@/lib/utils/retry', () => ({
  withRetry: mockWithRetry,
  circuitBreakers: {
    whatsapp: { canExecute: vi.fn(() => true) },
  },
  generateIdempotencyKey: (scope: string, uniqueId: string) => `${scope}:${uniqueId}`,
  hasBeenProcessed: mockHasBeenProcessed,
  markAsProcessed: mockMarkAsProcessed,
}));

import { whatsappService } from '@/lib/services/whatsapp.service';

describe('whatsappService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasBeenProcessed.mockResolvedValue(false);
    mockMarkAsProcessed.mockResolvedValue(undefined);
    mockLogMessage.mockResolvedValue(undefined);
    mockWithRetry.mockResolvedValue({
      data: { messages: [{ id: 'wamid.123' }] },
      attempts: 1,
    });
  });

  describe('sendTextMessage', () => {
    it('continues sending when the idempotency check throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockHasBeenProcessed.mockRejectedValueOnce(new Error('db down'));

      const result = await whatsappService.sendTextMessage('447700900123', 'Hello', 'enq-1');

      expect(result).toEqual({ messageId: 'wamid.123', success: true });
      expect(mockWithRetry).toHaveBeenCalledTimes(1);
      expect(mockMarkAsProcessed).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[WhatsApp] Idempotency check failed; continuing send',
        expect.objectContaining({
          to: '447700900123',
          enquiryId: 'enq-1',
          scope: 'wa-text',
          error: expect.any(Error),
        }),
      );
    });
  });

  describe('sendTemplateMessage', () => {
    it('continues sending when the template idempotency check throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockHasBeenProcessed.mockRejectedValueOnce(new Error('db down'));

      const result = await whatsappService.sendTemplateMessage(
        '447700900123',
        'appointment_confirmation',
        'en',
        ['Tuesday'],
        'enq-1',
      );

      expect(result).toEqual({ messageId: 'wamid.123', success: true });
      expect(mockWithRetry).toHaveBeenCalledTimes(1);
      expect(mockMarkAsProcessed).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[WhatsApp] Idempotency check failed; continuing send',
        expect.objectContaining({
          to: '447700900123',
          enquiryId: 'enq-1',
          templateName: 'appointment_confirmation',
          scope: 'wa-tpl',
          error: expect.any(Error),
        }),
      );
    });
  });
});
