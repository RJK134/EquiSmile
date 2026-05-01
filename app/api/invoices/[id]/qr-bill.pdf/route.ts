/**
 * GET /api/invoices/[id]/qr-bill.pdf — render the Swiss QR-bill
 * payment part for a single invoice.
 *
 * Pulls the invoice + customer + practice creditor info, hands them
 * to the qr-bill service, and streams the resulting PDF back to the
 * caller with a sensible filename.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  readPracticeCreditor,
  renderQRBillPdf,
} from '@/lib/services/qr-bill.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  let creditor;
  try {
    creditor = readPracticeCreditor();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Practice creditor configuration is incomplete.',
      },
      { status: 503 },
    );
  }

  const pdf = await renderQRBillPdf({
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.total,
    currency: invoice.currency,
    reference: invoice.qrReference,
    creditor,
    debtor: { name: invoice.customer.fullName },
    message: `Invoice ${invoice.invoiceNumber}`,
  });

  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
