import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    horse: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { horseRepository } from '@/lib/repositories/horse.repository';

describe('horseRepository — soft delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findMany excludes tombstoned rows by default', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([]);
    mockPrisma.horse.count.mockResolvedValue(0);

    await horseRepository.findMany({
      active: undefined,
      page: 1,
      pageSize: 20,
      includeDeleted: false,
    });

    expect(mockPrisma.horse.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
  });

  it('delete tombstones the horse without destroying clinical history', async () => {
    mockPrisma.horse.update.mockResolvedValue({ id: 'h1' });

    await horseRepository.delete('h1', 'user-7');

    const call = mockPrisma.horse.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'h1', deletedAt: null });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
    expect(call.data.deletedById).toBe('user-7');

    // Critical invariant: the Prisma delete that would cascade-destroy
    // attachments / charts / findings / prescriptions is NEVER called.
    expect(mockPrisma.horse.delete).not.toHaveBeenCalled();
  });

  it('restore clears the tombstone', async () => {
    mockPrisma.horse.update.mockResolvedValue({ id: 'h1' });
    await horseRepository.restore('h1');
    expect(mockPrisma.horse.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { deletedAt: null, deletedById: null },
    });
  });

  it('hardDelete is the explicit operator-only erasure path', async () => {
    mockPrisma.horse.delete.mockResolvedValue({ id: 'h1' });
    await horseRepository.hardDelete('h1');
    expect(mockPrisma.horse.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
  });
});
