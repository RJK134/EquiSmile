/**
 * Stock-reply service (G-2b from the May 2026 client user-story triage).
 *
 * Backs the "Reply with template" action on the triage queue. The vet
 * picks one of four stock canned replies, previews it, and confirms send.
 * No silent auto-send — the client's acceptance criterion explicitly
 * requires that "automated responses must remain editable and reviewable".
 *
 * The service:
 *   - looks up the visit request → customer (channel + language)
 *   - resolves the bilingual body string for the chosen template
 *   - sends via WhatsApp or email per the customer's preferred channel,
 *     reusing the existing whatsappService / emailService paths
 *     (DEMO_MODE-aware via PR #104 — simulator routing happens there)
 *   - logs to AuditLog so the operator surface has a tamper-evident
 *     "what was sent and to whom" trail
 *
 * All outbound logging passes through the existing `messageLogService`
 * via whatsappService (it auto-logs when the enquiryId is supplied) so
 * the demo's WhatsAppMessageLog panel surfaces every stock reply.
 */

import { prisma } from '@/lib/prisma';
import { whatsappService } from '@/lib/services/whatsapp.service';
import { emailService } from '@/lib/services/email.service';
import { auditLogService } from '@/lib/services/audit-log.service';
import { logger } from '@/lib/utils/logger';
import type { StockReplyTemplateName } from '@/lib/demo/template-registry';
// buildStockReplyBody lives in a pure file (no nodemailer/prisma imports)
// so the triage modal can import it client-side without dragging server
// dependencies into the client bundle.
import { buildStockReplyBody } from '@/lib/demo/stock-reply-bodies';
import type { AuthenticatedSubject } from '@/lib/auth/rbac';

export interface SendStockReplyInput {
  visitRequestId: string;
  template: StockReplyTemplateName;
  actor: AuthenticatedSubject;
}

export interface SendStockReplyResult {
  sent: boolean;
  channel: 'WHATSAPP' | 'EMAIL' | 'NONE';
  templateName: string;
  enquiryId: string | null;
  error?: string;
}

export const stockReplyService = {
  buildStockReplyBody,

  async sendStockReply(input: SendStockReplyInput): Promise<SendStockReplyResult> {
    const visitRequest = await prisma.visitRequest.findUnique({
      where: { id: input.visitRequestId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            mobilePhone: true,
            email: true,
            preferredChannel: true,
            preferredLanguage: true,
          },
        },
        enquiry: { select: { id: true } },
      },
    });

    if (!visitRequest || !visitRequest.customer) {
      return {
        sent: false,
        channel: 'NONE',
        templateName: input.template,
        enquiryId: null,
        error: 'Visit request or customer not found',
      };
    }

    const customer = visitRequest.customer;
    const lang = customer.preferredLanguage || 'en';
    const body = buildStockReplyBody(input.template, customer.fullName, lang);
    const enquiryId = visitRequest.enquiry?.id ?? null;

    let channel: 'WHATSAPP' | 'EMAIL' | 'NONE' = 'NONE';
    let sent = false;
    let error: string | undefined;

    try {
      if (customer.preferredChannel === 'EMAIL' && customer.email) {
        channel = 'EMAIL';
        const subject = lang === 'fr' ? 'EquiSmile' : 'EquiSmile';
        const result = await emailService.sendBrandedEmail(
          customer.email,
          subject,
          body,
          lang,
          enquiryId ?? undefined,
        );
        sent = result.success;
        if (!sent) error = 'Email send failed';
      } else if (customer.mobilePhone) {
        channel = 'WHATSAPP';
        const result = await whatsappService.sendTextMessage(
          customer.mobilePhone,
          body,
          enquiryId ?? undefined,
          lang,
          { operationKey: `stock-reply-${input.template}-${visitRequest.id}` },
        );
        sent = result.success;
        if (!sent) error = 'WhatsApp send failed';
      } else if (customer.email) {
        channel = 'EMAIL';
        const result = await emailService.sendBrandedEmail(
          customer.email,
          'EquiSmile',
          body,
          lang,
          enquiryId ?? undefined,
        );
        sent = result.success;
        if (!sent) error = 'Email send failed';
      } else {
        error = 'Customer has no mobile phone or email on file';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown send error';
      logger.error('Stock-reply dispatch failed', {
        service: 'stock-reply-service',
        template: input.template,
        visitRequestId: input.visitRequestId,
        error,
      });
    }

    if (sent) {
      await auditLogService.record({
        action: 'TRIAGE_STOCK_REPLY_SENT',
        entityType: 'VisitRequest',
        entityId: visitRequest.id,
        actor: input.actor,
        details: {
          template: input.template,
          channel,
          customerId: customer.id,
        },
      });
    }

    return {
      sent,
      channel,
      templateName: input.template,
      enquiryId,
      error,
    };
  },
};
