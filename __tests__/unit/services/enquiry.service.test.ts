import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTx, mockPrisma, mockEnquiryRepo } = vi.hoisted(() => {
  const mockTx = {
    customer: { create: vi.fn() },
    enquiry: { create: vi.fn(), update: vi.fn() },
    visitRequest: { create: vi.fn() },
    triageTask: { create: vi.fn() },
  };

  return {
    mockTx,
    mockPrisma: {
      $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    },
    mockEnquiryRepo: {
      countByStatus: vi.fn(),
      findRecent: vi.fn(),
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/repositories/enquiry.repository', () => ({
  enquiryRepository: mockEnquiryRepo,
}));

import { enquiryService } from '@/lib/services/enquiry.service';

describe('enquiryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.customer.create.mockResolvedValue({ id: 'new-cust-1' });
    mockTx.enquiry.create.mockResolvedValue({ id: 'enq-1' });
    mockTx.enquiry.update.mockResolvedValue({});
    mockTx.visitRequest.create.mockResolvedValue({ id: 'vr-1' });
    mockTx.triageTask.create.mockResolvedValue({ id: 'tt-1' });
  });

  describe('createManualEnquiry', () => {
    it('creates enquiry with existing customer', async () => {
      const result = await enquiryService.createManualEnquiry({
        customerId: 'cust-1',
        channel: 'WHATSAPP',
        rawText: 'Horse needs dental',
        requestType: 'ROUTINE_DENTAL',
        urgencyLevel: 'ROUTINE',
        preferredDays: ['Mon', 'Wed'],
        preferredTimeBand: 'AM',
        yardId: 'yard-1',
        horseCount: 2,
      });

      expect(mockTx.customer.create).not.toHaveBeenCalled();
      expect(mockTx.enquiry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: 'WHATSAPP',
          customerId: 'cust-1',
          rawText: 'Horse needs dental',
          triageStatus: 'NEW',
        }),
      });
      expect(mockTx.visitRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'cust-1',
          requestType: 'ROUTINE_DENTAL',
          urgencyLevel: 'ROUTINE',
          yardId: 'yard-1',
          horseCount: 2,
          needsMoreInfo: false,
        }),
      });
      expect(result.enquiry).toBeDefined();
      expect(result.visitRequest).toBeDefined();
    });

    it('creates new customer when customerId not provided', async () => {
      await enquiryService.createManualEnquiry({
        newCustomerName: 'John Smith',
        newCustomerPhone: '+447700900002',
        channel: 'EMAIL',
        rawText: 'New horse needs visit',
        requestType: 'FIRST_VISIT',
        urgencyLevel: 'SOON',
        preferredDays: [],
        preferredTimeBand: 'ANY',
      });

      expect(mockTx.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullName: 'John Smith',
          mobilePhone: '+447700900002',
          preferredChannel: 'EMAIL',
        }),
      });
      expect(mockTx.enquiry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'new-cust-1',
        }),
      });
    });

    it('throws when no customer provided and no new customer name', async () => {
      await expect(
        enquiryService.createManualEnquiry({
          channel: 'WHATSAPP',
          rawText: 'Test',
          requestType: 'ROUTINE_DENTAL',
          urgencyLevel: 'ROUTINE',
          preferredDays: [],
          preferredTimeBand: 'ANY',
        })
      ).rejects.toThrow('Customer is required');
    });

    it('creates triage task for urgent requests', async () => {
      await enquiryService.createManualEnquiry({
        customerId: 'cust-1',
        channel: 'WHATSAPP',
        rawText: 'Horse in pain',
        requestType: 'URGENT_ISSUE',
        urgencyLevel: 'URGENT',
        preferredDays: ['Mon'],
        preferredTimeBand: 'ANY',
        yardId: 'yard-1',
        horseCount: 1,
      });

      expect(mockTx.triageTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          visitRequestId: 'vr-1',
          taskType: 'URGENT_REVIEW',
          status: 'OPEN',
        }),
      });
    });

    it('does not create triage task for routine requests', async () => {
      await enquiryService.createManualEnquiry({
        customerId: 'cust-1',
        channel: 'WHATSAPP',
        rawText: 'Routine dental checkup',
        requestType: 'ROUTINE_DENTAL',
        urgencyLevel: 'ROUTINE',
        preferredDays: ['Mon'],
        preferredTimeBand: 'ANY',
        yardId: 'yard-1',
        horseCount: 1,
      });

      expect(mockTx.triageTask.create).not.toHaveBeenCalled();
    });

    it('sets needsMoreInfo when missing yardId', async () => {
      await enquiryService.createManualEnquiry({
        customerId: 'cust-1',
        channel: 'WHATSAPP',
        rawText: 'Test',
        requestType: 'ROUTINE_DENTAL',
        urgencyLevel: 'ROUTINE',
        preferredDays: ['Mon'],
        preferredTimeBand: 'ANY',
        horseCount: 1,
      });

      expect(mockTx.visitRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ needsMoreInfo: true }),
      });
      expect(mockTx.enquiry.update).toHaveBeenCalledWith({
        where: { id: 'enq-1' },
        data: { triageStatus: 'NEEDS_INFO' },
      });
    });

    it('sets needsMoreInfo when missing horseCount', async () => {
      await enquiryService.createManualEnquiry({
        customerId: 'cust-1',
        channel: 'WHATSAPP',
        rawText: 'Test',
        requestType: 'ROUTINE_DENTAL',
        urgencyLevel: 'ROUTINE',
        preferredDays: ['Mon'],
        preferredTimeBand: 'ANY',
        yardId: 'yard-1',
      });

      expect(mockTx.visitRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ needsMoreInfo: true }),
      });
    });

    it('sets needsMoreInfo when preferredDays is empty', async () => {
      await enquiryService.createManualEnquiry({
        customerId: 'cust-1',
        channel: 'WHATSAPP',
        rawText: 'Test',
        requestType: 'ROUTINE_DENTAL',
        urgencyLevel: 'ROUTINE',
        preferredDays: [],
        preferredTimeBand: 'ANY',
        yardId: 'yard-1',
        horseCount: 2,
      });

      expect(mockTx.visitRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ needsMoreInfo: true }),
      });
    });
  });

  describe('getStats', () => {
    it('returns status counts and recent enquiries', async () => {
      mockEnquiryRepo.countByStatus.mockResolvedValue({ NEW: 3, TRIAGED: 2 });
      mockEnquiryRepo.findRecent.mockResolvedValue([{ id: '1' }]);

      const result = await enquiryService.getStats();

      expect(result.statusCounts).toEqual({ NEW: 3, TRIAGED: 2 });
      expect(result.recentEnquiries).toHaveLength(1);
    });
  });
});
