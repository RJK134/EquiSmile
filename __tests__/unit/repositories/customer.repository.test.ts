import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  // Phase 15 — `$transaction` is used for the soft-delete cascade. The
  // mock simply invokes the callback with the same prisma surface so
  // we can assert on child `updateMany` calls.
  const prismaSurface = {
    customer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    yard: {
      updateMany: vi.fn(),
    },
    horse: {
      updateMany: vi.fn(),
    },
  };
  return {
    mockPrisma: {
      ...prismaSurface,
      $transaction: vi.fn(async (cb: (tx: typeof prismaSurface) => unknown) => cb(prismaSurface)),
    },
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { customerRepository } from '@/lib/repositories/customer.repository';

describe('customerRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findMany', () => {
    it('filters out soft-deleted rows by default', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);

      await customerRepository.findMany({
        page: 1,
        pageSize: 20,
        includeDeleted: false,
      });

      const findManyCall = mockPrisma.customer.findMany.mock.calls[0][0];
      expect(findManyCall.where.deletedAt).toBeNull();
    });

    it('honours includeDeleted=true', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);

      await customerRepository.findMany({
        page: 1,
        pageSize: 20,
        includeDeleted: true,
      });

      const findManyCall = mockPrisma.customer.findMany.mock.calls[0][0];
      expect(findManyCall.where.deletedAt).toBeUndefined();
    });

    it('applies search filter alongside soft-delete filter', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);

      await customerRepository.findMany({
        search: 'Jones',
        page: 1,
        pageSize: 20,
        includeDeleted: false,
      });

      const findManyCall = mockPrisma.customer.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR).toHaveLength(3);
      expect(findManyCall.where.deletedAt).toBeNull();
    });

    it('calculates pagination correctly', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(45);

      const result = await customerRepository.findMany({
        page: 2,
        pageSize: 20,
        includeDeleted: false,
      });

      expect(result.totalPages).toBe(3);
      const findManyCall = mockPrisma.customer.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(20);
      expect(findManyCall.take).toBe(20);
    });
  });

  describe('findById', () => {
    it('excludes tombstoned rows by default', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      await customerRepository.findById('1');

      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: '1', deletedAt: null },
        include: expect.any(Object),
      });
    });

    it('returns a tombstoned row when includeDeleted=true', async () => {
      const tombstoned = { id: '1', fullName: 'Ghost', deletedAt: new Date() };
      mockPrisma.customer.findFirst.mockResolvedValue(tombstoned);

      const result = await customerRepository.findById('1', { includeDeleted: true });

      expect(result).toEqual(tombstoned);
      expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.any(Object),
      });
    });

    it('filters children by deletedAt:null by default', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);
      await customerRepository.findById('1');
      const call = mockPrisma.customer.findFirst.mock.calls[0][0];
      expect(call.include.yards.where).toEqual({ deletedAt: null });
      expect(call.include.horses.where).toEqual({ deletedAt: null });
    });

    it('shows cascaded children when includeDeleted=true so restore-preview is complete', async () => {
      // Without this, an admin inspecting a tombstoned customer for
      // restore would see zero yards/horses because they all share the
      // parent's `deletedAt` timestamp after a cascade.
      mockPrisma.customer.findFirst.mockResolvedValue({ id: '1', deletedAt: new Date() });
      await customerRepository.findById('1', { includeDeleted: true });
      const call = mockPrisma.customer.findFirst.mock.calls[0][0];
      expect(call.include.yards.where).toBeUndefined();
      expect(call.include.horses.where).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('soft-deletes the customer and cascades to yards/horses', async () => {
      mockPrisma.customer.update.mockResolvedValue({ id: '1' });

      await customerRepository.delete('1', 'user-42');

      // Customer update — where must require live row, and set deletedAt.
      const updateCall = mockPrisma.customer.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: '1', deletedAt: null });
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
      expect(updateCall.data.deletedById).toBe('user-42');

      // Cascade: yards + horses updateMany called with customerId + live filter.
      expect(mockPrisma.yard.updateMany).toHaveBeenCalledWith({
        where: { customerId: '1', deletedAt: null },
        data: expect.objectContaining({ deletedById: 'user-42' }),
      });
      expect(mockPrisma.horse.updateMany).toHaveBeenCalledWith({
        where: { customerId: '1', deletedAt: null },
        data: expect.objectContaining({ deletedById: 'user-42' }),
      });

      // Importantly, we never called prisma.customer.delete().
      expect(mockPrisma.customer.delete).not.toHaveBeenCalled();
    });

    it('accepts a null actor id', async () => {
      mockPrisma.customer.update.mockResolvedValue({ id: '1' });
      await customerRepository.delete('1');
      const updateCall = mockPrisma.customer.update.mock.calls[0][0];
      expect(updateCall.data.deletedById).toBeNull();
    });
  });

  describe('restore', () => {
    it('clears deletedAt on the customer and on children that share the parent tombstone timestamp', async () => {
      const parentDeletedAt = new Date('2026-04-22T12:34:56.789Z');
      mockPrisma.customer.findUnique.mockResolvedValue({
        deletedAt: parentDeletedAt,
      });
      mockPrisma.customer.update.mockResolvedValue({ id: '1' });

      await customerRepository.restore('1');

      const updateCall = mockPrisma.customer.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ deletedAt: null, deletedById: null });

      // Children are matched by deletedAt = parent's deletedAt, so an
      // independently tombstoned child (different timestamp) would NOT
      // be resurrected by this restore.
      expect(mockPrisma.yard.updateMany).toHaveBeenCalledWith({
        where: { customerId: '1', deletedAt: parentDeletedAt },
        data: { deletedAt: null, deletedById: null },
      });
      expect(mockPrisma.horse.updateMany).toHaveBeenCalledWith({
        where: { customerId: '1', deletedAt: parentDeletedAt },
        data: { deletedAt: null, deletedById: null },
      });
    });

    it('skips child updateMany when the customer was never tombstoned', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({ deletedAt: null });
      mockPrisma.customer.update.mockResolvedValue({ id: '1' });

      await customerRepository.restore('1');

      expect(mockPrisma.yard.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.horse.updateMany).not.toHaveBeenCalled();
    });

    it('throws when the customer does not exist', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue(null);
      await expect(customerRepository.restore('missing')).rejects.toThrow('not found');
    });
  });

  describe('hardDelete', () => {
    it('calls prisma.customer.delete — operator path for GDPR erasure', async () => {
      mockPrisma.customer.delete.mockResolvedValue({ id: '1' });
      await customerRepository.hardDelete('1');
      expect(mockPrisma.customer.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('count', () => {
    it('filters tombstoned rows by default', async () => {
      mockPrisma.customer.count.mockResolvedValue(42);
      const result = await customerRepository.count();
      expect(result).toBe(42);
      expect(mockPrisma.customer.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });

    it('includes tombstoned rows when includeDeleted=true', async () => {
      // Phase 16 — repository contract is `deletedAt: undefined` (key
      // present, value undefined) so the soft-delete extension in
      // lib/prisma.ts skips its auto-inject. See lib/prisma.ts →
      // injectSoftDeleteFilter.
      mockPrisma.customer.count.mockResolvedValue(50);
      await customerRepository.count({ includeDeleted: true });
      const call = mockPrisma.customer.count.mock.calls[0][0];
      expect(Object.prototype.hasOwnProperty.call(call.where, 'deletedAt')).toBe(true);
      expect(call.where.deletedAt).toBeUndefined();
    });
  });
});
