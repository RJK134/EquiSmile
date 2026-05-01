/**
 * POST /api/finance/imports — accept a CSV or CAMT.054 payload as
 * JSON { filename, format, content } and run the bank-import service.
 *
 * Kept simple: no multipart upload — the operator UI reads the file
 * client-side and posts the text. CAMT.054 + CSV are both reasonably
 * sized (typical month <100KB) so the JSON path is fine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { bankImportService } from '@/lib/services/bank-import.service';

const ImportSchema = z.object({
  filename: z.string().min(1).max(255),
  format: z.enum(['CSV', 'CAMT_054']),
  content: z.string().min(1).max(5_000_000),
  importedById: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') },
      { status: 400 },
    );
  }

  try {
    const batch = await bankImportService.importBatch(parsed.data);
    return NextResponse.json({
      ok: true,
      batchId: batch.id,
      entryCount: batch.entryCount,
      matchedCount: batch.matchedCount,
      status: batch.status,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Import failed',
      },
      { status: 422 },
    );
  }
}
