import { env } from '@/lib/env';
import { messageLogService } from '@/lib/services/message-log.service';
import { deadLetterService } from '@/lib/services/dead-letter.service';
import {
  withRetry,
  circuitBreakers,
  generateIdempotencyKey,
  hasBeenProcessed,
  markAsProcessed,
} from '@/lib/utils/retry';
import { logger } from '@/lib/utils/logger';

const GRAPH_API_VERSION = 'v21.0';

interface SendTextResult {
  messageId: string;
  success: boolean;
}

interface WhatsAppApiResponse {
  messages?: Array<{ id: string }>;
  error?: { message: string; type: string; code: number };
}

/**
 * Per-call options that let callers thread a deterministic idempotency
 * token through. Without this, callers previously relied on
 * `Date.now()`-based keys, which defeated the point: retries always
 * minted a "fresh" key and re-sent. The token should uniquely identify
 * the logical operation (e.g. `wa-confirmation:<appointmentId>`,
 * `wa-reminder-24h:<appointmentId>`) so a genuine retry collapses to a
 * single send while distinct operations stay independent.
 */
export interface WhatsAppSendOptions {
  operationKey?: string;
}

/**
 * WhatsApp outbound service using Meta Cloud API.
 * Includes retry with exponential backoff, circuit breaker, and idempotency.
 */
export const whatsappService = {
  /**
   * Send a plain text message via WhatsApp.
   */
  async sendTextMessage(
    to: string,
    text: string,
    enquiryId?: string,
    language: string = 'en',
    options: WhatsAppSendOptions = {},
  ): Promise<SendTextResult> {
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = env.WHATSAPP_ACCESS_TOKEN || env.WHATSAPP_API_TOKEN;

    if (!phoneNumberId || !accessToken) {
      logger.warn('Cannot send WhatsApp message because credentials are incomplete', {
        service: 'whatsapp-service',
        operation: 'send-text',
      });
      return { messageId: '', success: false };
    }

    // Idempotency: only when the caller provides a deterministic
    // operationKey. The previous `${to}:${enquiryId}:${Date.now()}` form
    // minted a fresh key every call and never deduplicated — which
    // meant a retrying cron could fire the same confirmation twice.
    // Callers that genuinely want at-most-once semantics (confirmation,
    // reminder, cancellation ack) now pass e.g.
    // `wa-confirmation:<appointmentId>`.
    const idempotencyKey = options.operationKey
      ? generateIdempotencyKey('wa-text', options.operationKey)
      : null;
    if (idempotencyKey && (await hasBeenProcessed(idempotencyKey))) {
      logger.warn('Duplicate WhatsApp send prevented', {
        service: 'whatsapp-service',
        operation: 'send-text',
        to,
        enquiryId,
        operationKey: options.operationKey,
      });
      return { messageId: '', success: true };
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    };

    try {
      const { data: result } = await withRetry(
        async (signal) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal,
          });

          const data: WhatsAppApiResponse = await response.json();

          if (!response.ok || data.error) {
            throw new Error(`WhatsApp API error (${response.status}): ${data.error?.message || 'Unknown'}`);
          }

          return data;
        },
        { maxRetries: 2, operationName: 'whatsapp-send-text' },
        circuitBreakers.whatsapp,
      );

      const messageId = result.messages?.[0]?.id || '';

      if (idempotencyKey) {
        await markAsProcessed(idempotencyKey, 'wa-text');
      }
      if (enquiryId) {
        await messageLogService.logMessage({
          enquiryId,
          direction: 'OUTBOUND',
          channel: 'WHATSAPP',
          messageText: text,
          sentOrReceivedAt: new Date(),
          externalMessageId: messageId,
        });
      }

      logger.info('WhatsApp message sent', {
        service: 'whatsapp-service',
        operation: 'send-text',
        to,
        messageId,
        language,
      });
      return { messageId, success: true };
    } catch (error) {
      logger.error('WhatsApp send failed', error, {
        service: 'whatsapp-service',
        operation: 'send-text',
        to,
        enquiryId,
      });
      // AMBER-15 — record the permanent failure for operator triage.
      await deadLetterService.enqueue({
        scope: 'whatsapp-send-text',
        payload: { to, enquiryId, language, messagePreview: text.slice(0, 120) },
        lastError: error,
        operationKey: options.operationKey ?? (enquiryId ? `wa-text:${enquiryId}` : null),
      });
      return { messageId: '', success: false };
    }
  },

  /**
   * Send a template message via WhatsApp.
   * Templates are pre-approved by Meta and support parameters.
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    language: string = 'en',
    parameters: string[] = [],
    enquiryId?: string,
    options: WhatsAppSendOptions = {},
  ): Promise<SendTextResult> {
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = env.WHATSAPP_ACCESS_TOKEN || env.WHATSAPP_API_TOKEN;

    if (!phoneNumberId || !accessToken) {
      logger.warn('Cannot send WhatsApp template because credentials are incomplete', {
        service: 'whatsapp-service',
        operation: 'send-template',
      });
      return { messageId: '', success: false };
    }

    // Same rule as sendTextMessage: only idempotent when the caller
    // supplies a deterministic operationKey. Fall back to none.
    const idempotencyKey = options.operationKey
      ? generateIdempotencyKey('wa-tpl', options.operationKey)
      : null;
    if (idempotencyKey && (await hasBeenProcessed(idempotencyKey))) {
      logger.warn('Duplicate WhatsApp template send prevented', {
        service: 'whatsapp-service',
        operation: 'send-template',
        to,
        templateName,
        enquiryId,
        operationKey: options.operationKey,
      });
      return { messageId: '', success: true };
    }

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

    const languageCode = language === 'fr' ? 'fr' : 'en';
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: parameters.length > 0
          ? [
              {
                type: 'body',
                parameters: parameters.map((p) => ({ type: 'text', text: p })),
              },
            ]
          : undefined,
      },
    };

    try {
      const { data: result } = await withRetry(
        async (signal) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal,
          });

          const data: WhatsAppApiResponse = await response.json();

          if (!response.ok || data.error) {
            throw new Error(`WhatsApp API error (${response.status}): ${data.error?.message || 'Unknown'}`);
          }

          return data;
        },
        { maxRetries: 2, operationName: 'whatsapp-send-template' },
        circuitBreakers.whatsapp,
      );

      const messageId = result.messages?.[0]?.id || '';

      if (idempotencyKey) {
        await markAsProcessed(idempotencyKey, 'wa-tpl');
      }
      if (enquiryId) {
        await messageLogService.logMessage({
          enquiryId,
          direction: 'OUTBOUND',
          channel: 'WHATSAPP',
          messageText: `[Template: ${templateName}] ${parameters.join(', ')}`,
          sentOrReceivedAt: new Date(),
          externalMessageId: messageId,
        });
      }

      logger.info('WhatsApp template sent', {
        service: 'whatsapp-service',
        operation: 'send-template',
        to,
        templateName,
        messageId,
        language: languageCode,
      });
      return { messageId, success: true };
    } catch (error) {
      logger.error('WhatsApp template send failed', error, {
        service: 'whatsapp-service',
        operation: 'send-template',
        to,
        templateName,
        enquiryId,
      });
      await deadLetterService.enqueue({
        scope: 'whatsapp-send-template',
        payload: { to, templateName, language, enquiryId, parameters },
        lastError: error,
        operationKey:
          options.operationKey ?? (enquiryId ? `wa-tpl:${enquiryId}:${templateName}` : null),
      });
      return { messageId: '', success: false };
    }
  },
};
