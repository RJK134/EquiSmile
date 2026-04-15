/**
 * Phase 9 — WhatsApp integration client with demo fallback.
 *
 * Uses real Meta WhatsApp Cloud API when credentials exist,
 * falls back to demo simulator otherwise.
 */

import { isDemoMode, demoLog } from '@/lib/demo/demo-mode';
import { simulateSendMessage } from '@/lib/demo/whatsapp-simulator';

const GRAPH_API_VERSION = 'v21.0';

interface SendResult {
  messageId: string;
  success: boolean;
  mode: 'live' | 'demo';
}

function hasCredentials(): boolean {
  return !!(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN)
  );
}

function getMode(): 'live' | 'demo' {
  if (isDemoMode()) return 'demo';
  if (!hasCredentials()) return 'demo';
  return 'live';
}

export const whatsappClient = {
  getMode,

  async sendText(to: string, text: string): Promise<SendResult> {
    const mode = getMode();

    if (mode === 'demo') {
      demoLog('WhatsApp sendText (demo)', { to });
      const result = await simulateSendMessage(to, text);
      return { messageId: result.messageId, success: result.success, mode: 'demo' };
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN)!;
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('[WhatsApp] API error', data.error);
      return { messageId: '', success: false, mode: 'live' };
    }

    const messageId = data.messages?.[0]?.id || '';
    return { messageId, success: true, mode: 'live' };
  },
};

// Log mode at import time (server start)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  console.log(`[WhatsApp] Client mode: ${getMode()}`);
}
