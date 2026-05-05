/**
 * POST /api/finance/imports — body-size validation.
 *
 * Vercel rejects JSON bodies above 4.5 MB before the handler runs, so
 * the route caps `content` at 4.4 MB via Zod. This test pins the limit
 * so a future bump cannot silently re-cross the platform cap and
 * surface as a confusing 413 to operators.
 */
import { describe, expect, it, vi } from 'vitest';

const importBatchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/bank-import.service', () => ({
  bankImportService: { importBatch: importBatchMock },
}));

function buildRequest(body: unknown) {
  return {
    json: async () => body,
  } as unknown as import('next/server').NextRequest;
}

describe('POST /api/finance/imports — body size guard', () => {
  it('rejects content above the Vercel-aligned 4.4 MB cap with 400 + zod error', async () => {
    importBatchMock.mockReset();
    const { POST } = await import('@/app/api/finance/imports/route');

    // 4.5 MB string — over the 4.4 MB Zod cap, still under raw Vercel limit
    // so this exercises the schema, not the platform.
    const oversized = 'x'.repeat(4_500_000);
    const res = await POST(
      buildRequest({
        filename: 'big.csv',
        format: 'CSV',
        content: oversized,
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    // Zod size message contains the limit; assert we never invoked the
    // service so the operator gets a fast, clear failure.
    expect(importBatchMock).not.toHaveBeenCalled();
  });

  it('accepts content at the upper bound (4.4 MB) and reaches the service', async () => {
    importBatchMock.mockReset();
    importBatchMock.mockResolvedValueOnce({
      id: 'batch-1',
      entryCount: 1,
      matchedCount: 0,
      status: 'IMPORTED',
    });
    const { POST } = await import('@/app/api/finance/imports/route');

    const atLimit = 'x'.repeat(4_400_000);
    const res = await POST(
      buildRequest({
        filename: 'edge.csv',
        format: 'CSV',
        content: atLimit,
      }),
    );

    expect(res.status).toBe(200);
    expect(importBatchMock).toHaveBeenCalledOnce();
  });
});
