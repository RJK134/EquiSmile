import { prisma } from '@/lib/prisma';
import { enquiryRepository } from '@/lib/repositories/enquiry.repository';
import { autoTriageService } from './auto-triage.service';
import type { ManualEnquiryInput } from '@/lib/validations/manual-enquiry.schema';

export const enquiryService = {
  async createManualEnquiry(input: ManualEnquiryInput) {
    const result = await prisma.$transaction(async (tx) => {
      // Create customer if needed
      let customerId = input.customerId;
      if (!customerId && input.newCustomerName) {
        const customer = await tx.customer.create({
          data: {
            fullName: input.newCustomerName,
            mobilePhone: input.newCustomerPhone || null,
            email: input.newCustomerEmail || null,
            preferredChannel: input.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL',
          },
        });
        customerId = customer.id;
      }

      if (!customerId) {
        throw new Error('Customer is required');
      }

      // Create enquiry
      const enquiry = await tx.enquiry.create({
        data: {
          channel: input.channel,
          customerId,
          yardId: input.yardId || null,
          sourceFrom: 'manual',
          subject: input.subject || null,
          rawText: input.rawText,
          receivedAt: new Date(),
          triageStatus: 'NEW',
        },
      });

      // Create visit request (auto-triage will refine these values)
      const visitRequest = await tx.visitRequest.create({
        data: {
          enquiryId: enquiry.id,
          customerId,
          yardId: input.yardId || null,
          requestType: input.requestType,
          urgencyLevel: input.urgencyLevel,
          horseCount: input.horseCount || null,
          preferredDays: input.preferredDays,
          preferredTimeBand: input.preferredTimeBand,
          needsMoreInfo: false,
          planningStatus: 'UNTRIAGED',
        },
      });

      return { enquiry, visitRequest };
    });

    // Run auto-triage after transaction completes
    try {
      await autoTriageService.triageEnquiry(
        result.enquiry.id,
        result.visitRequest.id,
        input.rawText,
      );
    } catch (err) {
      // Auto-triage failure must never block enquiry creation. Inner
      // services occasionally surface raw inbound text inside
      // `err.message` (e.g. "failed to parse: '<customer message>'"),
      // so logging `message` here would leak PII past the masking
      // utilities in lib/utils/logger.ts. Log the error CLASS only —
      // it's enough for an operator to grep the dead-letter queue or
      // open the relevant enquiry in the UI to see the full payload
      // through the normal redacted channels.
      const errorClass = err instanceof Error ? err.constructor.name : 'unknown';
      console.error('[ManualEnquiry] Auto-triage failed', {
        enquiryId: result.enquiry.id,
        errorClass,
      });
    }

    return result;
  },

  async getStats() {
    const [statusCounts, recentEnquiries] = await Promise.all([
      enquiryRepository.countByStatus(),
      enquiryRepository.findRecent(5),
    ]);
    return { statusCounts, recentEnquiries };
  },
};
