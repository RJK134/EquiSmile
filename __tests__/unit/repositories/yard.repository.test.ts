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

  it('restore clears the yard and only horses cascaded by the same tombstone', async () => {
    const parentDeletedAt = new Date('2026-04-22T12:34:56.789Z');
    mockPrisma.yard.findUnique.mockResolvedValue({ deletedAt: parentDeletedAt });
    mockPrisma.yard.update.mockResolvedValue({ id: 'y1' });

    await yardRepository.restore('y1');

    expect(mockPrisma.yard.update).toHaveBeenCalledWith({
      where: { id: 'y1' },
      data: { deletedAt: null, deletedById: null },
    });

    // Horses are matched by deletedAt = parent's deletedAt so that a
    // horse independently soft-deleted at some other moment stays
    // tombstoned.
    expect(mockPrisma.horse.updateMany).toHaveBeenCalledWith({
      where: { primaryYardId: 'y1', deletedAt: parentDeletedAt },
      data: { deletedAt: null, deletedById: null },
    });
  });

  it('restore skips horse updateMany when the yard was never tombstoned', async () => {
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
