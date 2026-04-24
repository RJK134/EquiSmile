/**
 * Phase 4 — Missing Information Detection and Follow-up Loops
 *
 * Detects incomplete visit requests, generates bilingual follow-up messages,
 * and manages follow-up scheduling and response processing.
 */

import { prisma } from '@/lib/prisma';
import { whatsappService } from './whatsapp.service';
import { emailService } from './email.service';
import { messageLogService } from './message-log.service';
import { parseMessage } from '@/lib/utils/message-parser';
import { runTriageRules, type TriageInput } from './triage-rules.service';

// ---------------------------------------------------------------------------
// Missing field detection
// ---------------------------------------------------------------------------

export interface MissingFieldCheck {
  field: string;
  label_en: string;
  label_fr: string;
}

export function checkCompleteness(vr: {
  yardId: string | null;
  horseCount: number | null;
  preferredDays: string[];
  customer: { mobilePhone?: string | null; email?: string | null } | null;
  yard: { postcode?: string | null } | null;
}): MissingFieldCheck[] {
  const missing: MissingFieldCheck[] = [];

  if (!vr.yard?.postcode && !vr.yardId) {
    missing.push({
      field: 'postcode',
      label_en: 'the postcode or address of your yard',
      label_fr: 'le code postal ou l\'adresse de votre écurie',
    });
  }

  if (!vr.horseCount) {
    missing.push({
      field: 'horseCount',
      label_en: 'how many horses need treatment',
      label_fr: 'combien de chevaux nécessitent un traitement',
    });
  }

  if (vr.preferredDays.length === 0) {
    missing.push({
      field: 'preferredDays',
      label_en: 'your preferred days for the visit',
      label_fr: 'vos jours préférés pour la visite',
    });
  }

  if (!vr.customer?.mobilePhone && !vr.customer?.email) {
    missing.push({
      field: 'contact',
      label_en: 'a phone number or email address',
      label_fr: 'un numéro de téléphone ou une adresse e-mail',
    });
  }

  return missing;
}

// ---------------------------------------------------------------------------
// Message generation
// ---------------------------------------------------------------------------

export function generateFollowUpMessage(
  customerName: string,
  missingFields: MissingFieldCheck[],
  language: string,
  isReminder: boolean = false,
): string {
  if (language === 'fr') {
    const items = missingFields.map((f) => `- ${f.label_fr}`).join('\n');
    if (isReminder) {
      return `Bonjour ${customerName}, nous souhaitons vous relancer concernant votre demande de soins dentaires. Pour planifier votre visite, pourriez-vous nous indiquer :\n${items}\nMerci ! — EquiSmile`;
    }
    return `Bonjour ${customerName}, merci pour votre demande de soins dentaires. Pour planifier votre visite, pourriez-vous nous indiquer :\n${items}\nMerci ! — EquiSmile`;
  }

  const items = missingFields.map((f) => `- ${f.label_en}`).join('\n');
  if (isReminder) {
    return `Hi ${customerName}, just a gentle reminder about your dental treatment enquiry. To help us plan your visit, could you please let us know:\n${items}\nThank you! — EquiSmile`;
  }
  return `Hi ${customerName}, thanks for your enquiry about dental treatment. To help us plan your visit, could you please let us know:\n${items}\nThank you! — EquiSmile`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const missingInfoService = {
  /**
   * Check a visit request for completeness and return missing fields.
   */
  checkCompleteness,

  /**
   * Send a follow-up message to the customer requesting missing info.
   */
  async sendFollowUp(visitRequestId: string): Promise<{ sent: boolean; channel?: string }> {
    const vr = await prisma.visitRequest.findUnique({
      where: { id: visitRequestId },
      include: {
        customer: true,
        yard: { select: { postcode: true } },
        enquiry: { select: { id: true, channel: true } },
      },
    });

    if (!vr || !vr.customer) {
      return { sent: false };
    }

    const missing = checkCompleteness({
      yardId: vr.yardId,
      horseCount: vr.horseCount,
      preferredDays: vr.preferredDays,
      customer: vr.customer,
      yard: vr.yard,
    });

    if (missing.length === 0) {
      return { sent: false };
    }

    const language = vr.customer.preferredLanguage || 'en';
    const isReminder = vr.followUpAttempts > 0;
    const message = generateFollowUpMessage(
      vr.customer.fullName,
      missing,
      language,
      isReminder,
    );

    const enquiryId = vr.enquiry?.id;
    let sent = false;

    // Send via preferred channel
    if (vr.customer.preferredChannel === 'WHATSAPP' && vr.customer.mobilePhone) {
      // One follow-up per (visitRequest × attempt counter) — so two cron
      // triggers on the same attempt collapse, but genuinely-new follow
      // ups on later attempts still go out.
      const result = await whatsappService.sendTextMessage(
        vr.customer.mobilePhone,
        message,
        enquiryId,
        language,
        { operationKey: `wa-missing-info:${visitRequestId}:${vr.followUpAttempts}` },
      );
      sent = result.success;
    } else if (vr.customer.email) {
      const subject = language === 'fr'
        ? 'EquiSmile — Informations complémentaires requises'
        : 'EquiSmile — Additional Information Needed';
      const result = await emailService.sendBrandedEmail(
        vr.customer.email,
        subject,
        message,
        language,
        enquiryId,
      );
      sent = result.success;
    }

    // Update follow-up tracking
    await prisma.visitRequest.update({
      where: { id: visitRequestId },
      data: {
        followUpAttempts: { increment: 1 },
        lastFollowUpAt: new Date(),
      },
    });

    // Log the outbound message even if the channel send failed (for audit)
    if (enquiryId && !sent) {
      await messageLogService.logMessage({
        enquiryId,
        direction: 'OUTBOUND',
        channel: vr.customer.preferredChannel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL',
        messageText: `[Follow-up attempt ${vr.followUpAttempts + 1} - send ${sent ? 'succeeded' : 'failed'}] ${message}`,
        sentOrReceivedAt: new Date(),
      });
    }

    return {
      sent,
      channel: vr.customer.preferredChannel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL',
    };
  },

  /**
   * Process a follow-up response: re-parse the message, update fields,
   * close resolved tasks, advance to planning pool if complete.
   */
  async processResponse(
    enquiryId: string,
    visitRequestId: string,
    messageText: string,
  ): Promise<{ resolved: string[]; stillMissing: string[] }> {
    const vr = await prisma.visitRequest.findUnique({
      where: { id: visitRequestId },
      include: {
        yard: { select: { postcode: true } },
        triageTasks: { where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } },
      },
    });

    if (!vr) throw new Error('Visit request not found');

    // Re-parse the message
    const parsed = parseMessage(messageText);
    const updates: Record<string, unknown> = {};
    const resolved: string[] = [];

    // Check if postcode was provided
    if (parsed.postcodes.length > 0 && !vr.yard?.postcode) {
      resolved.push('postcode');
    }

    // Check if horse count was provided
    if (parsed.horseCount && !vr.horseCount) {
      updates.horseCount = parsed.horseCount;
      resolved.push('horseCount');
    }

    // Apply updates to visit request
    if (Object.keys(updates).length > 0) {
      await prisma.visitRequest.update({
        where: { id: visitRequestId },
        data: updates,
      });
    }

    // Close resolved triage tasks
    for (const task of vr.triageTasks) {
      const taskFieldMap: Record<string, string> = {
        ASK_FOR_POSTCODE: 'postcode',
        ASK_HORSE_COUNT: 'horseCount',
        CLARIFY_SYMPTOMS: 'symptoms',
      };
      const taskField = taskFieldMap[task.taskType];
      if (taskField && resolved.includes(taskField)) {
        await prisma.triageTask.update({
          where: { id: task.id },
          data: { status: 'DONE', notes: `Auto-resolved from customer response` },
        });
      }
    }

    // Re-run triage to check if everything is now complete
    const input: TriageInput = {
      messageText,
      horseCount: (updates.horseCount as number) || vr.horseCount,
      hasPostcode: resolved.includes('postcode') || !!vr.yard?.postcode,
      hasYard: !!vr.yardId,
      hasPreferredDays: vr.preferredDays.length > 0,
    };
    const triageResult = runTriageRules(input);

    // If all info is now present, advance to planning pool
    if (!triageResult.needsMoreInfo) {
      await prisma.visitRequest.update({
        where: { id: visitRequestId },
        data: {
          needsMoreInfo: false,
          planningStatus: triageResult.urgency === 'URGENT' ? 'READY_FOR_REVIEW' : 'PLANNING_POOL',
        },
      });

      await prisma.enquiry.update({
        where: { id: enquiryId },
        data: { triageStatus: 'TRIAGED' },
      });
    }

    const stillMissing = triageResult.missingFields.map((f) => f.field);
    return { resolved, stillMissing };
  },

  /**
   * Find visit requests that need follow-up reminders.
   * - 48h since last follow-up → send reminder
   * - 96h since last follow-up → escalate to admin
   */
  async findOverdueFollowUps(): Promise<{
    needsReminder: Array<{ id: string; followUpAttempts: number }>;
    needsEscalation: Array<{ id: string; followUpAttempts: number }>;
  }> {
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const ninetySixHoursAgo = new Date(now.getTime() - 96 * 60 * 60 * 1000);

    const overdueItems = await prisma.visitRequest.findMany({
      where: {
        needsMoreInfo: true,
        planningStatus: { notIn: ['COMPLETED', 'CANCELLED'] },
        lastFollowUpAt: { not: null },
      },
      select: {
        id: true,
        followUpAttempts: true,
        lastFollowUpAt: true,
      },
    });

    const needsReminder: Array<{ id: string; followUpAttempts: number }> = [];
    const needsEscalation: Array<{ id: string; followUpAttempts: number }> = [];

    for (const item of overdueItems) {
      if (!item.lastFollowUpAt) continue;

      if (item.lastFollowUpAt < ninetySixHoursAgo) {
        needsEscalation.push({ id: item.id, followUpAttempts: item.followUpAttempts });
      } else if (item.lastFollowUpAt < fortyEightHoursAgo && item.followUpAttempts < 2) {
        needsReminder.push({ id: item.id, followUpAttempts: item.followUpAttempts });
      }
    }

    return { needsReminder, needsEscalation };
  },

  /**
   * Escalate an overdue item by creating a manual triage task.
   */
  async escalateToAdmin(visitRequestId: string): Promise<void> {
    await prisma.triageTask.create({
      data: {
        visitRequestId,
        taskType: 'MANUAL_CLASSIFICATION',
        status: 'OPEN',
        notes: 'Escalated: no response after 96 hours of follow-up attempts',
        escalatedAt: new Date(),
      },
    });
  },
};
