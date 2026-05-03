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
import type { AuthenticatedSubject } from '@/lib/auth/rbac';

interface StockReplyBodyMap {
  en: string;
  fr: string;
}

const STOCK_REPLY_BODIES: Record<StockReplyTemplateName, (customerName: string) => StockReplyBodyMap> = {
  faq_acknowledge_v1: (name) => ({
    en: `Hi ${name}, thanks for getting in touch — we've received your enquiry and will be back to you within 24 hours.`,
    fr: `Bonjour ${name}, merci de votre message — nous avons bien reçu votre demande et reviendrons vers vous sous 24 heures.`,
  }),
  faq_request_info_v1: (name) => ({
    en: `Hi ${name}, to schedule your visit could you tell us your postcode, how many horses, and any specific concerns? Reply when you have a moment.`,
    fr: `Bonjour ${name}, pour planifier votre visite, pourriez-vous nous indiquer votre code postal, le nombre de chevaux, et toute préoccupation particulière ? Répondez quand vous le pouvez.`,
  }),
  faq_routine_booking_v1: (name) => ({
    en: `Hi ${name}, routine dental visits typically slot into our local route runs every 4–6 weeks. We'll propose a time that fits — please confirm your preferred week.`,
    fr: `Bonjour ${name}, les contrôles dentaires de routine s'intègrent dans nos tournées locales toutes les 4 à 6 semaines. Nous vous proposerons un créneau adapté — merci de confirmer votre semaine préférée.`,
  }),
  faq_emergency_redirect_v1: (name) => ({
    en: `Hi ${name}, if your horse is in distress (pain, bleeding, not eating, swelling), please call us directly so we can prioritise. Reply here for non-urgent matters.`,
    fr: `Bonjour ${name}, si votre cheval est en détresse (douleur, saignement, refus de manger, gonflement), merci d'appeler directement pour que nous puissions prioriser. Répondez ici pour les questions non urgentes.`,
  }),
};

export function buildStockReplyBody(
  template: StockReplyTemplateName,
  customerName: string,
  language: string,
): string {
  const builder = STOCK_REPLY_BODIES[template];
  const bodies = builder(customerName);
  return language === 'fr' ? bodies.fr : bodies.en;
}

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
