/**
 * Phase D6 — Monthly accounting export.
 *
 * Generates an Excel (.xlsx) workbook with three sheets:
 *   1. Summary       — totals by status + payment method
 *   2. Invoices      — every invoice issued in the month
 *   3. Payments      — every payment received in the month
 *
 * The same module dispatches the workbook by email when the
 * EQUISMILE_FINANCE_REPORT_RECIPIENTS env var is set, so a cron
 * (n8n / Postgres pg_cron / GitHub Actions) can run a one-shot
 * "first of the month" job and the practice owner gets the report
 * in their inbox.
 */

import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services/email.service';
import { BRAND_NAME, BRAND_PRIMARY_HEX, loadLogoPng } from '@/lib/branding/asset';

export interface MonthlyExportInput {
  year: number;
  month: number; // 1–12
}

export interface MonthlyReportSummary {
  totalInvoiced: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  totalOutstanding: Prisma.Decimal;
  invoiceCount: number;
  paymentCount: number;
}

const ZERO = new Prisma.Decimal(0);

function monthRange(year: number, month: number): { from: Date; to: Date } {
  // Inclusive start, exclusive end. Use UTC so the boundary is
  // unambiguous regardless of server timezone.
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { from, to };
}

function formatYM(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Build the workbook as an in-memory Buffer. Pure function vs the
 * DB query and email side-effect.
 */
export function buildWorkbook(args: {
  ym: string;
  invoices: Array<{
    invoiceNumber: string;
    customerName: string;
    issuedAt: Date;
    dueAt: Date;
    total: Prisma.Decimal;
    status: string;
    qrReference: string | null;
    currency: string;
  }>;
  payments: Array<{
    invoiceNumber: string;
    customerName: string;
    paidAt: Date;
    amount: Prisma.Decimal;
    method: string;
    reference: string | null;
  }>;
  summary: MonthlyReportSummary;
}): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND_NAME;
  wb.created = new Date();

  // Summary sheet
  const summarySheet = wb.addWorksheet('Summary');

  // Logo + report title — embed the EquiSmile mark when public/logo.png
  // is available; otherwise drop in a brand-coloured text title so the
  // workbook always carries the practice name on the first sheet.
  const logoPng = loadLogoPng();
  if (logoPng) {
    // ExcelJS's Buffer typing is older than Node 22's Buffer<ArrayBufferLike>.
    // base64 is universally accepted and avoids the cast.
    const imageId = wb.addImage({
      base64: `data:image/png;base64,${logoPng.toString('base64')}`,
      extension: 'png',
    });
    summarySheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 160, height: 40 },
    });
    // Reserve the visual space — three blank rows before the table.
    summarySheet.addRow([]);
    summarySheet.addRow([]);
    summarySheet.addRow([]);
  } else {
    const titleRow = summarySheet.addRow([`${BRAND_NAME} — Monthly Finance Report`]);
    titleRow.font = { name: 'Calibri', size: 18, bold: true, color: { argb: `FF${BRAND_PRIMARY_HEX.toUpperCase()}` } };
    summarySheet.mergeCells(`A${titleRow.number}:B${titleRow.number}`);
    summarySheet.addRow([]);
  }

  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 32 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  // The columns directive resets row 1's header, but we've already
  // pushed our title above — addRow continues from the current cursor.
  summarySheet.addRow({ metric: 'Reporting period', value: args.ym });
  summarySheet.addRow({ metric: 'Invoices issued', value: args.summary.invoiceCount });
  summarySheet.addRow({ metric: 'Payments received', value: args.summary.paymentCount });
  summarySheet.addRow({
    metric: 'Total invoiced (CHF)',
    value: args.summary.totalInvoiced.toFixed(2),
  });
  summarySheet.addRow({
    metric: 'Total paid (CHF)',
    value: args.summary.totalPaid.toFixed(2),
  });
  summarySheet.addRow({
    metric: 'Total outstanding (CHF)',
    value: args.summary.totalOutstanding.toFixed(2),
  });
  summarySheet.getRow(1).font = { bold: true };

  // Invoices sheet
  const invoicesSheet = wb.addWorksheet('Invoices');
  invoicesSheet.columns = [
    { header: 'Invoice #', key: 'invoiceNumber', width: 20 },
    { header: 'Customer', key: 'customerName', width: 28 },
    { header: 'Issued', key: 'issuedAt', width: 14 },
    { header: 'Due', key: 'dueAt', width: 14 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'QR Reference', key: 'qrReference', width: 32 },
  ];
  for (const inv of args.invoices) {
    invoicesSheet.addRow({
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName,
      issuedAt: inv.issuedAt.toISOString().slice(0, 10),
      dueAt: inv.dueAt.toISOString().slice(0, 10),
      total: parseFloat(inv.total.toFixed(2)),
      currency: inv.currency,
      status: inv.status,
      qrReference: inv.qrReference ?? '',
    });
  }
  invoicesSheet.getRow(1).font = { bold: true };

  // Payments sheet
  const paymentsSheet = wb.addWorksheet('Payments');
  paymentsSheet.columns = [
    { header: 'Invoice #', key: 'invoiceNumber', width: 20 },
    { header: 'Customer', key: 'customerName', width: 28 },
    { header: 'Paid at', key: 'paidAt', width: 14 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Method', key: 'method', width: 16 },
    { header: 'Reference', key: 'reference', width: 32 },
  ];
  for (const pay of args.payments) {
    paymentsSheet.addRow({
      invoiceNumber: pay.invoiceNumber,
      customerName: pay.customerName,
      paidAt: pay.paidAt.toISOString().slice(0, 10),
      amount: parseFloat(pay.amount.toFixed(2)),
      method: pay.method,
      reference: pay.reference ?? '',
    });
  }
  paymentsSheet.getRow(1).font = { bold: true };

  return wb;
}

export const financeExportService = {
  buildWorkbook,

  /**
   * Query the database for the month's data and return both the
   * Excel buffer and the summary stats so the API route + email
   * dispatch can consume one result.
   */
  async generateMonthlyReport(input: MonthlyExportInput): Promise<{
    filename: string;
    buffer: Buffer;
    summary: MonthlyReportSummary;
  }> {
    const { year, month } = input;
    const ym = formatYM(year, month);
    const { from, to } = monthRange(year, month);

    const invoices = await prisma.invoice.findMany({
      where: { issuedAt: { gte: from, lt: to } },
      include: { customer: { select: { fullName: true } } },
      orderBy: { issuedAt: 'asc' },
    });

    const payments = await prisma.invoicePayment.findMany({
      where: { paidAt: { gte: from, lt: to } },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            customer: { select: { fullName: true } },
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    });

    const totalInvoiced = invoices.reduce(
      (acc, inv) => acc.plus(inv.total),
      ZERO,
    );
    const totalPaid = payments.reduce((acc, p) => acc.plus(p.amount), ZERO);
    const totalOutstanding = totalInvoiced.minus(totalPaid);

    const wb = buildWorkbook({
      ym,
      invoices: invoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer.fullName,
        issuedAt: inv.issuedAt,
        dueAt: inv.dueAt,
        total: inv.total,
        status: inv.status,
        qrReference: inv.qrReference,
        currency: inv.currency,
      })),
      payments: payments.map((pay) => ({
        invoiceNumber: pay.invoice.invoiceNumber,
        customerName: pay.invoice.customer.fullName,
        paidAt: pay.paidAt,
        amount: pay.amount,
        method: pay.method,
        reference: pay.reference,
      })),
      summary: {
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        invoiceCount: invoices.length,
        paymentCount: payments.length,
      },
    });

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return {
      filename: `equismile-finance-${ym}.xlsx`,
      buffer: Buffer.from(arrayBuffer as ArrayBuffer),
      summary: {
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        invoiceCount: invoices.length,
        paymentCount: payments.length,
      },
    };
  },

  /**
   * Email the monthly report to the configured recipients. Returns
   * { sent: true } on success, { sent: false, reason } when SMTP is
   * unconfigured or recipients are missing.
   */
  async emailMonthlyReport(input: MonthlyExportInput): Promise<{
    sent: boolean;
    recipients?: string;
    reason?: string;
  }> {
    const recipientsRaw = process.env.EQUISMILE_FINANCE_REPORT_RECIPIENTS;
    if (!recipientsRaw) {
      return { sent: false, reason: 'EQUISMILE_FINANCE_REPORT_RECIPIENTS unset' };
    }

    const { filename, buffer, summary } = await this.generateMonthlyReport(input);
    const ym = formatYM(input.year, input.month);

    const subject = `EquiSmile finance report — ${ym}`;
    const text = [
      `Finance report for ${ym}`,
      '',
      `Invoices issued: ${summary.invoiceCount}`,
      `Payments received: ${summary.paymentCount}`,
      `Total invoiced: CHF ${summary.totalInvoiced.toFixed(2)}`,
      `Total paid: CHF ${summary.totalPaid.toFixed(2)}`,
      `Total outstanding: CHF ${summary.totalOutstanding.toFixed(2)}`,
      '',
      'Workbook attached.',
    ].join('\n');

    const result = await emailService.sendEmail({
      to: recipientsRaw,
      subject,
      text,
      attachments: [
        {
          filename,
          content: buffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });

    return result.success
      ? { sent: true, recipients: recipientsRaw }
      : { sent: false, reason: 'email-send-failed' };
  },
};
