/**
 * Phase 9 — n8n webhook integration client with demo fallback.
 *
 * Uses real n8n webhook URLs when configured,
 * falls back to demo simulation otherwise.
 */

import { isDemoMode, demoLog } from '@/lib/demo/demo-mode';

interface WebhookResult {
  success: boolean;
  statusCode: number;
  mode: 'live' | 'demo';
  data?: unknown;
}

function hasCredentials(): boolean {
  return !!(process.env.N8N_WEBHOOK_URL && process.env.N8N_API_KEY);
}

function getMode(): 'live' | 'demo' {
  if (isDemoMode()) return 'demo';
  if (!hasCredentials()) return 'demo';
  return 'live';
}

export const n8nClient = {
  getMode,

  async triggerWebhook(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookResult> {
    const mode = getMode();

    if (mode === 'demo') {
      demoLog('n8n webhook trigger (demo)', { path, payload });
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
      return { success: true, statusCode: 200, mode: 'demo', data: { simulated: true } };
    }

    const baseUrl = process.env.N8N_WEBHOOK_URL!;
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_API_KEY ? { Authorization: `Bearer ${process.env.N8N_API_KEY}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return {
      success: response.ok,
      statusCode: response.status,
      mode: 'live',
      data,
    };
  },
};

// Log mode at import time (server start)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  console.log(`[n8n] Client mode: ${getMode()}`);
}
