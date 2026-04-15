import { env } from '@/lib/env';
import { messageLogService } from '@/lib/services/message-log.service';

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

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data: WhatsAppApiResponse = await response.json();

      if (!response.ok || data.error) {
        console.error('[WhatsApp] Send failed', { status: response.status, error: data.error });
        return { messageId: '', success: false };
      }

      const messageId = data.messages?.[0]?.id || '';

      // Log outbound message
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
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data: WhatsAppApiResponse = await response.json();

      if (!response.ok || data.error) {
        console.error('[WhatsApp] Template send failed', { status: response.status, error: data.error });
        return { messageId: '', success: false };
      }

      const messageId = data.messages?.[0]?.id || '';

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

      console.log('[WhatsApp] Template sent', { to, templateName, messageId, language: languageCode });
      return { messageId, success: true };
    } catch (error) {
      console.error('[WhatsApp] Template send error', error);
      return { messageId: '', success: false };
    }
  },
};
