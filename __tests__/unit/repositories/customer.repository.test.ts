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
    it('clears deletedAt on the customer and only cascade-deleted children', async () => {
      const cascadeDeletedAt = new Date('2024-01-02T10:00:00Z');
      mockPrisma.customer.findUnique.mockResolvedValue({ deletedAt: cascadeDeletedAt });
      mockPrisma.customer.update.mockResolvedValue({ id: '1' });
      await customerRepository.restore('1');

      const updateCall = mockPrisma.customer.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ deletedAt: null, deletedById: null });
      expect(mockPrisma.yard.updateMany).toHaveBeenCalledWith({
        where: { customerId: '1', deletedAt: cascadeDeletedAt },
        data: { deletedAt: null, deletedById: null },
      });
      expect(mockPrisma.horse.updateMany).toHaveBeenCalledWith({
        where: { customerId: '1', deletedAt: cascadeDeletedAt },
        data: { deletedAt: null, deletedById: null },
      });
    });

    it('does not resurrect independently soft-deleted children', async () => {
      // Horse tombstoned on Monday; customer tombstoned on Tuesday.
      // Restoring the customer on Wednesday must leave the horse
      // tombstoned because its deletedAt does not match the cascade's.
      const customerDeletedAt = new Date('2024-01-02T10:00:00Z');
      mockPrisma.customer.findUnique.mockResolvedValue({ deletedAt: customerDeletedAt });
      mockPrisma.customer.update.mockResolvedValue({ id: '1' });

      await customerRepository.restore('1');

      const horseCall = mockPrisma.horse.updateMany.mock.calls[0][0];
      expect(horseCall.where.deletedAt).toEqual(customerDeletedAt);
    });

    it('is a no-op on children when the customer was not tombstoned', async () => {
      mockPrisma.customer.findUnique.mockResolvedValue({ deletedAt: null });
      mockPrisma.customer.update.mockResolvedValue({ id: '1' });

      await customerRepository.restore('1');

      expect(mockPrisma.yard.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.horse.updateMany).not.toHaveBeenCalled();
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
      mockPrisma.customer.count.mockResolvedValue(50);
      await customerRepository.count({ includeDeleted: true });
      expect(mockPrisma.customer.count).toHaveBeenCalledWith({ where: undefined });
    });
  });
});
