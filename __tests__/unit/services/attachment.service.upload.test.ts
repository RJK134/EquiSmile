import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFs, mockPrisma } = vi.hoisted(() => ({
  mockFs: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    readFile: vi.fn(),
  },
  mockPrisma: {
    horse: {
      findUnique: vi.fn(),
    },
    horseAttachment: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('node:fs', () => ({
  promises: mockFs,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { attachmentService } from '@/lib/services/attachment.service';

describe('attachmentService.upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.horse.findUnique.mockResolvedValue({ id: 'horse-1' });
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
  });

  it('removes the uploaded file if the database insert fails', async () => {
    const insertError = new Error('Foreign key constraint failed');
    mockPrisma.horseAttachment.create.mockRejectedValue(insertError);

    await expect(
      attachmentService.upload({
        horseId: 'horse-1',
        filename: 'chart.pdf',
        mimeType: 'application/pdf',
        bytes: new Uint8Array([1, 2, 3]),
        uploadedById: 'missing-staff',
      }),
    ).rejects.toThrow(insertError);

    expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    expect(mockFs.unlink).toHaveBeenCalledTimes(1);
    expect(mockFs.unlink.mock.calls[0][0]).toBe(mockFs.writeFile.mock.calls[0][0]);
  });
});
