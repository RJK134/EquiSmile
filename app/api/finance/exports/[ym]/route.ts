/**
 * GET  /api/finance/exports/{YYYY-MM}                 → download .xlsx
 * POST /api/finance/exports/{YYYY-MM}?action=email    → email to recipients
 *
 * Single endpoint for the monthly accounting export. The path
 * parameter is the year-month in `YYYY-MM` form; we validate it
 * before doing any DB work.
 */

import { NextRequest, NextResponse } from 'next/server';
import { financeExportService } from '@/lib/services/finance-export.service';

const YM_PATTERN = /^(\d{4})-(\d{2})$/;

function parseYearMonth(ym: string): { year: number; month: number } | null {
  const match = ym.match(YM_PATTERN);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ym: string }> },
) {
  const { ym } = await params;
  const parsed = parseYearMonth(ym);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid year-month — expected YYYY-MM.' },
      { status: 400 },
    );
  }

  const { filename, buffer } = await financeExportService.generateMonthlyReport(parsed);
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ ym: string }> },
) {
  const { ym } = await params;
  const parsed = parseYearMonth(ym);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid year-month — expected YYYY-MM.' },
      { status: 400 },
    );
  }
  const result = await financeExportService.emailMonthlyReport(parsed);
  if (!result.sent) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, recipients: result.recipients });
}
