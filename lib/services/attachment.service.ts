import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { prisma } from '@/lib/prisma';
import type { AttachmentKind, HorseAttachment } from '@prisma/client';

/**
 * Phase 12 — Horse attachment storage.
 *
 * Files are written to `ATTACHMENT_STORAGE_DIR` (defaults to `./data/attachments`).
 * The DB stores a *relative* path so the storage backend can be swapped (S3,
 * GCS, shared volume) without a data migration — only `loadBytes` would change.
 */

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIMES = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const KIND_BY_MIME: Record<string, AttachmentKind> = {
  'application/pdf': 'DENTAL_CHART_PDF',
  'image/jpeg': 'DENTAL_IMAGE',
  'image/png': 'DENTAL_IMAGE',
  'image/webp': 'DENTAL_IMAGE',
  'image/heic': 'DENTAL_IMAGE',
  'image/heif': 'DENTAL_IMAGE',
};

export function inferKindFromMime(mime: string): AttachmentKind {
  return KIND_BY_MIME[mime] ?? 'OTHER';
}

export function attachmentStorageRoot(): string {
  return process.env.ATTACHMENT_STORAGE_DIR || path.resolve(process.cwd(), 'data', 'attachments');
}

export function validateAttachment(input: { mimeType: string; sizeBytes: number }): void {
  if (!ALLOWED_MIMES.has(input.mimeType)) {
    throw new Error(`Unsupported file type: ${input.mimeType}`);
  }
  if (input.sizeBytes <= 0) {
    throw new Error('Uploaded file is empty');
  }
  if (input.sizeBytes > MAX_BYTES) {
    throw new Error(`File exceeds maximum size of ${MAX_BYTES / (1024 * 1024)} MB`);
  }
}

export function buildRelativePath(horseId: string, filename: string): string {
  const ext = path.extname(filename) || '.bin';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = crypto.randomBytes(6).toString('hex');
  return path.posix.join(horseId, `${stamp}-${random}${ext}`);
}

export interface UploadAttachmentInput {
  horseId: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  kind?: AttachmentKind;
  description?: string | null;
  uploadedById?: string | null;
}

export const attachmentService = {
  async upload(input: UploadAttachmentInput): Promise<HorseAttachment> {
    validateAttachment({ mimeType: input.mimeType, sizeBytes: input.bytes.byteLength });

    const horse = await prisma.horse.findUnique({ where: { id: input.horseId }, select: { id: true } });
    if (!horse) throw new Error('Horse not found');

    const relativePath = buildRelativePath(input.horseId, input.filename);
    const absPath = path.join(attachmentStorageRoot(), relativePath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, input.bytes);

    return prisma.horseAttachment.create({
      data: {
        horseId: input.horseId,
        kind: input.kind ?? inferKindFromMime(input.mimeType),
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.bytes.byteLength,
        storagePath: relativePath,
        description: input.description ?? null,
        uploadedById: input.uploadedById ?? null,
      },
    });
  },

  async listForHorse(horseId: string) {
    return prisma.horseAttachment.findMany({
      where: { horseId },
      orderBy: { uploadedAt: 'desc' },
    });
  },

  async findById(id: string) {
    return prisma.horseAttachment.findUnique({ where: { id } });
  },

  async loadBytes(attachment: Pick<HorseAttachment, 'storagePath'>): Promise<Uint8Array> {
    const absPath = path.join(attachmentStorageRoot(), attachment.storagePath);
    return fs.readFile(absPath);
  },

  async delete(id: string): Promise<void> {
    const existing = await prisma.horseAttachment.findUnique({ where: { id } });
    if (!existing) return;

    await prisma.horseAttachment.delete({ where: { id } });

    const absPath = path.join(attachmentStorageRoot(), existing.storagePath);
    try {
      await fs.unlink(absPath);
    } catch {
      // File may already be missing; DB row is removed either way.
    }
  },
};

export const ATTACHMENT_LIMITS = { MAX_BYTES, ALLOWED_MIMES };
