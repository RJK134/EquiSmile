import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    enquiry: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { enquiryRepository } from '@/lib/repositories/enquiry.repository';

describe('enquiryRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findMany', () => {
    it('returns paginated enquiries', async () => {
      const enquiries = [{ id: '1', channel: 'WHATSAPP', rawText: 'Test' }];
      mockPrisma.enquiry.findMany.mockResolvedValue(enquiries);
      mockPrisma.enquiry.count.mockResolvedValue(1);

      const result = await enquiryRepository.findMany({ page: 1, pageSize: 20 });

      expect(result.data).toEqual(enquiries);
      expect(result.total).toBe(1);
    });

    it('filters by triage status', async () => {
      mockPrisma.enquiry.findMany.mockResolvedValue([]);
      mockPrisma.enquiry.count.mockResolvedValue(0);

      await enquiryRepository.findMany({
        triageStatus: 'NEEDS_INFO',
        page: 1,
        pageSize: 20,
      });

      const call = mockPrisma.enquiry.findMany.mock.calls[0][0];
      expect(call.where.triageStatus).toBe('NEEDS_INFO');
    });

    it('filters by channel', async () => {
      mockPrisma.enquiry.findMany.mockResolvedValue([]);
      mockPrisma.enquiry.count.mockResolvedValue(0);

      await enquiryRepository.findMany({
        channel: 'EMAIL',
        page: 1,
        pageSize: 20,
      });

      const call = mockPrisma.enquiry.findMany.mock.calls[0][0];
      expect(call.where.channel).toBe('EMAIL');
    });

    it('applies search filter', async () => {
      mockPrisma.enquiry.findMany.mockResolvedValue([]);
      mockPrisma.enquiry.count.mockResolvedValue(0);

      await enquiryRepository.findMany({
        search: 'dental',
        page: 1,
        pageSize: 20,
      });

      const call = mockPrisma.enquiry.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR[0].rawText.contains).toBe('dental');
    });
  });

  describe('findById', () => {
    it('returns enquiry with includes', async () => {
      const enquiry = { id: '1', customer: {}, yard: {}, messages: [], visitRequests: [] };
      mockPrisma.enquiry.findUnique.mockResolvedValue(enquiry);

      const result = await enquiryRepository.findById('1');
      expect(result).toEqual(enquiry);
    });
  });

  describe('countByStatus', () => {
    it('returns counts grouped by status', async () => {
      mockPrisma.enquiry.groupBy.mockResolvedValue([
        { triageStatus: 'NEW', _count: { id: 5 } },
        { triageStatus: 'TRIAGED', _count: { id: 3 } },
      ]);

      const result = await enquiryRepository.countByStatus();
      expect(result).toEqual({ NEW: 5, TRIAGED: 3 });
    });
  });

  describe('findRecent', () => {
    it('returns recent enquiries with limit', async () => {
      const recent = [{ id: '1' }, { id: '2' }];
      mockPrisma.enquiry.findMany.mockResolvedValue(recent);

      const result = await enquiryRepository.findRecent(2);

      expect(result).toEqual(recent);
      const call = mockPrisma.enquiry.findMany.mock.calls[0][0];
      expect(call.take).toBe(2);
      expect(call.orderBy).toEqual({ receivedAt: 'desc' });
    });
  });
});
