import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const prismaSurface = {
    yard: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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

import { yardRepository } from '@/lib/repositories/yard.repository';

describe('yardRepository — soft delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findMany excludes tombstoned rows by default', async () => {
    mockPrisma.yard.findMany.mockResolvedValue([]);
    mockPrisma.yard.count.mockResolvedValue(0);

    await yardRepository.findMany({
      page: 1,
      pageSize: 20,
      includeDeleted: false,
    });

    expect(mockPrisma.yard.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
  });

  it('restore un-tombstones the yard AND only the horses cascaded with it', async () => {
    const cascadeDeletedAt = new Date('2024-02-10T09:30:00Z');
    mockPrisma.yard.findUnique.mockResolvedValue({ deletedAt: cascadeDeletedAt });
    mockPrisma.yard.update.mockResolvedValue({ id: 'y1' });

    await yardRepository.restore('y1');

    expect(mockPrisma.yard.update).toHaveBeenCalledWith({
      where: { id: 'y1' },
      data: { deletedAt: null, deletedById: null },
    });
    // Horses are only restored when their deletedAt matches the yard's
    // tombstone moment — this protects rows that were soft-deleted
    // independently before the yard was.
    expect(mockPrisma.horse.updateMany).toHaveBeenCalledWith({
      where: { primaryYardId: 'y1', deletedAt: cascadeDeletedAt },
      data: { deletedAt: null, deletedById: null },
    });
  });

  it('restore is a no-op on horses when the yard was not tombstoned', async () => {
    mockPrisma.yard.findUnique.mockResolvedValue({ deletedAt: null });
    mockPrisma.yard.update.mockResolvedValue({ id: 'y1' });

    await yardRepository.restore('y1');

    expect(mockPrisma.horse.updateMany).not.toHaveBeenCalled();
  });

  it('delete tombstones the yard and orphaned horses pointing at it', async () => {
    mockPrisma.yard.update.mockResolvedValue({ id: 'y1' });

    await yardRepository.delete('y1', 'user-9');

    const updateCall = mockPrisma.yard.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: 'y1', deletedAt: null });
    expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
    expect(updateCall.data.deletedById).toBe('user-9');

    expect(mockPrisma.horse.updateMany).toHaveBeenCalledWith({
      where: { primaryYardId: 'y1', deletedAt: null },
      data: expect.objectContaining({ deletedById: 'user-9' }),
    });

    expect(mockPrisma.yard.delete).not.toHaveBeenCalled();
  });
});
