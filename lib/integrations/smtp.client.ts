/**
 * Phase 9 — SMTP integration client with demo fallback.
 *
 * Uses real nodemailer SMTP transport when credentials exist,
 * falls back to demo simulator otherwise.
 */

import { isDemoMode, demoLog } from '@/lib/demo/demo-mode';
import { simulateSmtpSend } from '@/lib/demo/email-simulator';

interface SendResult {
  messageId: string;
  success: boolean;
  mode: 'live' | 'demo';
}

interface SendOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function hasCredentials(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  );
}

function getMode(): 'live' | 'demo' {
  if (isDemoMode()) return 'demo';
  if (!hasCredentials()) return 'demo';
  return 'live';
}

export const smtpClient = {
  getMode,

  async send(options: SendOptions): Promise<SendResult> {
    const mode = getMode();

    if (mode === 'demo') {
      demoLog('SMTP send (demo)', { to: options.to, subject: options.subject });
      const result = await simulateSmtpSend(options.to, options.subject, options.text);
      return { messageId: result.messageId, success: result.success, mode: 'demo' };
    }

    // Dynamic import to avoid loading nodemailer in demo mode
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASSWORD!,
      },
    });

    const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

    const info = await transporter.sendMail({
      from: `EquiSmile <${from}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return {
      messageId: info.messageId || '',
      success: true,
      mode: 'live',
    };
  },
};

// Log mode at import time (server start)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  console.log(`[SMTP] Client mode: ${getMode()}`);
}
