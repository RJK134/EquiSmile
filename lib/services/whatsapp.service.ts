import { env } from '@/lib/env';
import { messageLogService } from '@/lib/services/message-log.service';
import {
  withRetry,
  circuitBreakers,
  generateIdempotencyKey,
  hasBeenProcessed,
  markAsProcessed,
} from '@/lib/utils/retry';

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
    language: string = 'en'
  ): Promise<SendTextResult> {
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = env.WHATSAPP_ACCESS_TOKEN || env.WHATSAPP_API_TOKEN;

    if (!phoneNumberId || !accessToken) {
      console.warn('[WhatsApp] Cannot send message: missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN');
      return { messageId: '', success: false };
    }

    // Idempotency: prevent duplicate sends on retry
    const idempotencyKey = generateIdempotencyKey('wa-text', `${to}:${enquiryId || 'none'}:${Date.now()}`);
    if (enquiryId && hasBeenProcessed(idempotencyKey)) {
      console.warn('[WhatsApp] Duplicate send prevented', { to, enquiryId });
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

      if (enquiryId) {
        markAsProcessed(idempotencyKey);
        await messageLogService.logMessage({
          enquiryId,
          direction: 'OUTBOUND',
          channel: 'WHATSAPP',
          messageText: text,
          sentOrReceivedAt: new Date(),
          externalMessageId: messageId,
        });
      }

      console.log('[WhatsApp] Message sent', { to, messageId, language });
      return { messageId, success: true };
    } catch (error) {
      console.error('[WhatsApp] Send error', error);
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
    enquiryId?: string
  ): Promise<SendTextResult> {
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = env.WHATSAPP_ACCESS_TOKEN || env.WHATSAPP_API_TOKEN;

    if (!phoneNumberId || !accessToken) {
      console.warn('[WhatsApp] Cannot send template: missing credentials');
      return { messageId: '', success: false };
    }

    const idempotencyKey = generateIdempotencyKey('wa-tpl', `${to}:${templateName}:${enquiryId || 'none'}:${Date.now()}`);
    if (enquiryId && hasBeenProcessed(idempotencyKey)) {
      console.warn('[WhatsApp] Duplicate template send prevented', { to, templateName });
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

      if (enquiryId) {
        markAsProcessed(idempotencyKey);
        await messageLogService.logMessage({
          enquiryId,
          direction: 'OUTBOUND',
          channel: 'WHATSAPP',
          messageText: `[Template: ${templateName}] ${parameters.join(', ')}`,
          sentOrReceivedAt: new Date(),
          externalMessageId: messageId,
        });
      }

      console.log('[WhatsApp] Template sent', { to, templateName, messageId, language: languageCode });
      return { messageId, success: true };
    } catch (error) {
      console.error('[WhatsApp] Template send error', error);
      return { messageId: '', success: false };
    }
  },
};
