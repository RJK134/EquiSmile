/**
 * Pure body builders for the four stock-reply templates (G-2b — Phase A.3).
 *
 * Importable from BOTH client (the modal previews the body before send)
 * and server (the dispatcher service in `lib/services/stock-reply.service.ts`).
 * Zero side effects, zero Node-only dependencies — keep it that way so
 * Next.js doesn't accidentally bundle nodemailer / prisma into the
 * client chunk via this file.
 */

import type { StockReplyTemplateName } from '@/lib/demo/template-registry';

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
