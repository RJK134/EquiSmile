import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const prismaSurface = {
    yard: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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

  it('restore un-tombstones the yard AND horses cascaded by an earlier delete', async () => {
    mockPrisma.yard.update.mockResolvedValue({ id: 'y1' });

    await yardRepository.restore('y1');

    expect(mockPrisma.yard.update).toHaveBeenCalledWith({
      where: { id: 'y1' },
      data: { deletedAt: null, deletedById: null },
    });
    expect(mockPrisma.horse.updateMany).toHaveBeenCalledWith({
      where: { primaryYardId: 'y1' },
      data: { deletedAt: null, deletedById: null },
    });
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
