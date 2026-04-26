import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    enquiry: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

      const result = await enquiryRepository.findMany({
        page: 1,
        pageSize: 20,
        includeDeleted: false,
      });

      expect(result.data).toEqual(enquiries);
      expect(result.total).toBe(1);
    });

    it('hides tombstoned rows by default', async () => {
      mockPrisma.enquiry.findMany.mockResolvedValue([]);
      mockPrisma.enquiry.count.mockResolvedValue(0);

      await enquiryRepository.findMany({
        page: 1,
        pageSize: 20,
        includeDeleted: false,
      });

      const call = mockPrisma.enquiry.findMany.mock.calls[0][0];
      expect(call.where.deletedAt).toBeNull();
    });

    it('surfaces tombstoned rows when includeDeleted=true', async () => {
      mockPrisma.enquiry.findMany.mockResolvedValue([]);
      mockPrisma.enquiry.count.mockResolvedValue(0);

      await enquiryRepository.findMany({
        page: 1,
        pageSize: 20,
        includeDeleted: true,
      });

      const call = mockPrisma.enquiry.findMany.mock.calls[0][0];
      expect(call.where.deletedAt).toBeUndefined();
    });

    it('filters by triage status', async () => {
      mockPrisma.enquiry.findMany.mockResolvedValue([]);
      mockPrisma.enquiry.count.mockResolvedValue(0);

      await enquiryRepository.findMany({
        triageStatus: 'NEEDS_INFO',
        page: 1,
        pageSize: 20,
        includeDeleted: false,
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
        includeDeleted: false,
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
        includeDeleted: false,
      });

      const call = mockPrisma.enquiry.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR[0].rawText.contains).toBe('dental');
    });
  });

  describe('findById', () => {
    it('returns enquiry with includes (excluding tombstoned by default)', async () => {
      const enquiry = { id: '1', customer: {}, yard: {}, messages: [], visitRequests: [] };
      mockPrisma.enquiry.findFirst.mockResolvedValue(enquiry);

      const result = await enquiryRepository.findById('1');
      expect(result).toEqual(enquiry);

      const call = mockPrisma.enquiry.findFirst.mock.calls[0][0];
      expect(call.where).toEqual({ id: '1', deletedAt: null });
    });

    it('returns enquiry even if tombstoned when includeDeleted=true', async () => {
      mockPrisma.enquiry.findFirst.mockResolvedValue({ id: '1' });

      await enquiryRepository.findById('1', { includeDeleted: true });

      const call = mockPrisma.enquiry.findFirst.mock.calls[0][0];
      expect(call.where).toEqual({ id: '1' });
    });
  });

  describe('countByStatus', () => {
    it('returns counts grouped by status, excluding tombstoned by default', async () => {
      mockPrisma.enquiry.groupBy.mockResolvedValue([
        { triageStatus: 'NEW', _count: { id: 5 } },
        { triageStatus: 'TRIAGED', _count: { id: 3 } },
      ]);

      const result = await enquiryRepository.countByStatus();
      expect(result).toEqual({ NEW: 5, TRIAGED: 3 });

      const call = mockPrisma.enquiry.groupBy.mock.calls[0][0];
      expect(call.where).toEqual({ deletedAt: null });
    });
  });

  describe('findRecent', () => {
    it('returns recent enquiries with limit and excludes tombstoned', async () => {
      const recent = [{ id: '1' }, { id: '2' }];
      mockPrisma.enquiry.findMany.mockResolvedValue(recent);

      const result = await enquiryRepository.findRecent(2);

      expect(result).toEqual(recent);
      const call = mockPrisma.enquiry.findMany.mock.calls[0][0];
      expect(call.take).toBe(2);
      expect(call.orderBy).toEqual({ receivedAt: 'desc' });
      expect(call.where).toEqual({ deletedAt: null });
    });
  });

  describe('soft delete', () => {
    it('delete sets deletedAt and deletedById, scoped to live rows only', async () => {
      mockPrisma.enquiry.update.mockResolvedValue({ id: '1' });

      await enquiryRepository.delete('1', 'user-99');

      const call = mockPrisma.enquiry.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: '1', deletedAt: null });
      expect(call.data.deletedAt).toBeInstanceOf(Date);
      expect(call.data.deletedById).toBe('user-99');
    });

    it('restore clears deletedAt + deletedById', async () => {
      mockPrisma.enquiry.update.mockResolvedValue({ id: '1' });

      await enquiryRepository.restore('1');

      const call = mockPrisma.enquiry.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: '1' });
      expect(call.data).toEqual({ deletedAt: null, deletedById: null });
    });

    it('hardDelete is a real prisma.delete (operator-only path)', async () => {
      mockPrisma.enquiry.delete.mockResolvedValue({ id: '1' });

      await enquiryRepository.hardDelete('1');

      expect(mockPrisma.enquiry.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('update refuses to mutate a tombstoned row via the standard path', async () => {
      mockPrisma.enquiry.update.mockResolvedValue({ id: '1' });

      await enquiryRepository.update('1', { subject: 'updated' });

      const call = mockPrisma.enquiry.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: '1', deletedAt: null });
    });
  });
});
