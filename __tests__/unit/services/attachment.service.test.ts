import { describe, it, expect } from 'vitest';
import {
  inferKindFromMime,
  validateAttachment,
  buildRelativePath,
  ATTACHMENT_LIMITS,
} from '@/lib/services/attachment.service';

describe('inferKindFromMime', () => {
  it('maps PDFs to DENTAL_CHART_PDF', () => {
    expect(inferKindFromMime('application/pdf')).toBe('DENTAL_CHART_PDF');
  });

  it('maps common image mimes to DENTAL_IMAGE', () => {
    expect(inferKindFromMime('image/jpeg')).toBe('DENTAL_IMAGE');
    expect(inferKindFromMime('image/png')).toBe('DENTAL_IMAGE');
    expect(inferKindFromMime('image/webp')).toBe('DENTAL_IMAGE');
    expect(inferKindFromMime('image/heic')).toBe('DENTAL_IMAGE');
  });

  it('falls back to OTHER for unknown mimes', () => {
    expect(inferKindFromMime('application/zip')).toBe('OTHER');
    expect(inferKindFromMime('text/plain')).toBe('OTHER');
  });
});

describe('validateAttachment', () => {
  it('rejects unsupported mime types', () => {
    expect(() =>
      validateAttachment({ mimeType: 'application/zip', sizeBytes: 1000 }),
    ).toThrow(/Unsupported file type/);
  });

  it('rejects empty files', () => {
    expect(() =>
      validateAttachment({ mimeType: 'application/pdf', sizeBytes: 0 }),
    ).toThrow(/empty/);
  });

  it('rejects files exceeding MAX_BYTES', () => {
    expect(() =>
      validateAttachment({ mimeType: 'application/pdf', sizeBytes: ATTACHMENT_LIMITS.MAX_BYTES + 1 }),
    ).toThrow(/exceeds maximum size/);
  });

  it('accepts a valid PDF under the limit', () => {
    expect(() => validateAttachment({ mimeType: 'application/pdf', sizeBytes: 50_000 })).not.toThrow();
  });
});

describe('buildRelativePath', () => {
  it('nests under the horse id and keeps the original extension', () => {
    const rel = buildRelativePath('horse-123', 'chart.pdf');
    expect(rel.startsWith('horse-123/')).toBe(true);
    expect(rel.endsWith('.pdf')).toBe(true);
  });

  it('falls back to .bin when the filename has no extension', () => {
    const rel = buildRelativePath('horse-123', 'scan');
    expect(rel.endsWith('.bin')).toBe(true);
  });

  it('produces a unique path on each call (collision resistance)', () => {
    const a = buildRelativePath('h', 'x.png');
    const b = buildRelativePath('h', 'x.png');
    expect(a).not.toBe(b);
  });
});
