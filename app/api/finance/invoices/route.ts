/**
 * GET /api/finance/invoices — list invoices with optional filters.
 *
 * Query parameters:
 *   - status   — single FinanceInvoiceStatus or comma-separated list
 *   - customer — customer id
 *   - limit / offset
 */

import { NextRequest, NextResponse } from 'next/server';
import type { FinanceInvoiceStatus } from '@prisma/client';
import { invoiceService } from '@/lib/services/invoice.service';

const VALID_STATUSES: FinanceInvoiceStatus[] = [
  'DRAFT',
  'OPEN',
  'PARTIAL',
  'PAID',
  'OVERDUE',
  'CANCELLED',
];

function parseStatus(raw: string | null): FinanceInvoiceStatus | FinanceInvoiceStatus[] | undefined {
  if (!raw) return undefined;
  const requested = raw.split(',').map((s) => s.trim().toUpperCase()) as FinanceInvoiceStatus[];
  const allowed = requested.filter((s) => VALID_STATUSES.includes(s));
  if (allowed.length === 0) return undefined;
  if (allowed.length === 1) return allowed[0];
  return allowed;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const status = parseStatus(sp.get('status'));
  const customerId = sp.get('customer') ?? undefined;
  const limit = Math.min(parseInt(sp.get('limit') ?? '50', 10) || 50, 200);
  const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0);

  const result = await invoiceService.list({
    status,
    customerId,
    limit,
    offset,
  });

  return NextResponse.json({
    data: result.data.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId,
      issuedAt: inv.issuedAt.toISOString(),
      dueAt: inv.dueAt.toISOString(),
      total: inv.total.toString(),
      currency: inv.currency,
      status: inv.status,
      qrReference: inv.qrReference,
    })),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
}
