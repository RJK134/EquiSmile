import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '@/lib/env';
import { messageLogService } from '@/lib/services/message-log.service';
import { withRetry, circuitBreakers } from '@/lib/utils/retry';

interface SendEmailResult {
  messageId: string;
  success: boolean;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  enquiryId?: string;
  language?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    console.warn('[Email] Cannot create transporter: missing SMTP config');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT, 10),
    secure: parseInt(env.SMTP_PORT, 10) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

/**
 * Build branded HTML email template.
 */
function buildHtmlEmail(body: string, language: string = 'en'): string {
  const footerText =
    language === 'fr'
      ? 'Cet email a été envoyé par EquiSmile — Opérations dentaires équines'
      : 'This email was sent by EquiSmile — Equine Dental Operations';

  return `<!DOCTYPE html>
<html lang="${language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:#16a34a;padding:20px 30px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;">🦷 EquiSmile</h1>
        </td></tr>
        <tr><td style="padding:30px;">
          ${body}
        </td></tr>
        <tr><td style="padding:15px 30px;background-color:#f4f4f5;text-align:center;">
          <p style="margin:0;color:#71717a;font-size:12px;">${footerText}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Email outbound service using nodemailer/SMTP.
 */
export const emailService = {
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const transport = getTransporter();
    if (!transport) {
      return { messageId: '', success: false };
    }

    const from = env.SMTP_FROM || env.SMTP_USER;
    const html = options.html || buildHtmlEmail(
      `<p style="color:#18181b;font-size:14px;line-height:1.6;">${options.text.replace(/\n/g, '<br>')}</p>`,
      options.language
    );

    try {
      const { data: info } = await withRetry(
        async () => {
          return transport.sendMail({
            from: `EquiSmile <${from}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html,
          });
        },
        { maxRetries: 2, operationName: 'email-send', timeoutMs: 30_000 },
        circuitBreakers.email,
      );

      const messageId = info.messageId || '';

      // Log outbound message
      if (options.enquiryId) {
        await messageLogService.logMessage({
          enquiryId: options.enquiryId,
          direction: 'OUTBOUND',
          channel: 'EMAIL',
          messageText: options.text,
          sentOrReceivedAt: new Date(),
          externalMessageId: messageId,
        });
      }

      console.log('[Email] Sent', { to: options.to, messageId, subject: options.subject });
      return { messageId, success: true };
    } catch (error) {
      console.error('[Email] Send failed', error);
      return { messageId: '', success: false };
    }
  },

  /**
   * Send a bilingual email using the branded template.
   */
  async sendBrandedEmail(
    to: string,
    subject: string,
    bodyText: string,
    language: string = 'en',
    enquiryId?: string
  ): Promise<SendEmailResult> {
    const html = buildHtmlEmail(
      `<p style="color:#18181b;font-size:14px;line-height:1.6;">${bodyText.replace(/\n/g, '<br>')}</p>`,
      language
    );

    return this.sendEmail({
      to,
      subject,
      text: bodyText,
      html,
      enquiryId,
      language,
    });
  },
};
