import { prisma } from '@/lib/prisma';
import { enquiryRepository } from '@/lib/repositories/enquiry.repository';
import type { ManualEnquiryInput } from '@/lib/validations/manual-enquiry.schema';

export const enquiryService = {
  async createManualEnquiry(input: ManualEnquiryInput) {
    return prisma.$transaction(async (tx) => {
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

      // Determine if needs more info
      const needsMoreInfo = !input.yardId || !input.horseCount || input.preferredDays.length === 0;

      // Create visit request
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
          needsMoreInfo,
          planningStatus: input.urgencyLevel === 'URGENT' ? 'UNTRIAGED' : 'UNTRIAGED',
        },
      });

      // If urgent, create triage task
      if (input.urgencyLevel === 'URGENT') {
        await tx.triageTask.create({
          data: {
            visitRequestId: visitRequest.id,
            taskType: 'URGENT_REVIEW',
            status: 'OPEN',
          },
        });
      }

      // If needs more info, update triage status
      if (needsMoreInfo) {
        await tx.enquiry.update({
          where: { id: enquiry.id },
          data: { triageStatus: 'NEEDS_INFO' },
        });
      }

      return { enquiry, visitRequest };
    });
  },

  async getStats() {
    const [statusCounts, recentEnquiries] = await Promise.all([
      enquiryRepository.countByStatus(),
      enquiryRepository.findRecent(5),
    ]);
    return { statusCounts, recentEnquiries };
  },
};
