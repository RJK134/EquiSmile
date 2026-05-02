/**
 * Phase D3 — Swiss QR-bill PDF generation.
 *
 * Wraps the `swissqrbill` package + PDFKit so the API route + future
 * monthly export can render a payment part for any Invoice row.
 *
 * Practice creditor info is sourced from env vars so a fresh deploy
 * just needs to populate `.env`. Demo deploys get sensible
 * placeholder values that produce a valid (though obviously test)
 * QR-bill — useful for the visual demo without leaking real banking
 * credentials.
 */

import PDFDocument from 'pdfkit';
import { SwissQRBill } from 'swissqrbill/pdf';
import type { Data as QRBillData } from 'swissqrbill/types';
import { Prisma } from '@prisma/client';
import { BRAND_NAME, loadLogoPng } from '@/lib/branding/asset';

export interface QRBillCreditor {
  name: string;
  address: string;
  buildingNumber?: string | number;
  zip: string | number;
  city: string;
  country: string;
  /** Swiss QR-IBAN (starts with CH/LI, 21 chars). */
  account: string;
}

export interface QRBillDebtor {
  name: string;
  address?: string;
  buildingNumber?: string | number;
  zip?: string | number;
  city?: string;
  country?: string;
}

export interface RenderQRBillInput {
  invoiceNumber: string;
  amount: Prisma.Decimal | number | string;
  currency?: string;
  reference?: string | null;
  message?: string;
  creditor: QRBillCreditor;
  debtor?: QRBillDebtor;
}

const DEMO_CREDITOR: QRBillCreditor = {
  name: 'EquiSmile (Demo Practice)',
  address: 'Route du Lac',
  buildingNumber: '12',
  zip: '1844',
  city: 'Villeneuve',
  country: 'CH',
  // Test QR-IBAN (Swiss SIX test range — never collects real funds).
  account: 'CH4431999123000889012',
};

/**
 * Read the practice's creditor record from env vars. Falls back to
 * the placeholder above when DEMO_MODE=true so the demo always
 * renders a valid QR-bill without leaking production banking info.
 */
export function readPracticeCreditor(): QRBillCreditor {
  const env = process.env;
  const required = [
    env.EQUISMILE_PRACTICE_NAME,
    env.EQUISMILE_PRACTICE_ADDRESS,
    env.EQUISMILE_PRACTICE_ZIP,
    env.EQUISMILE_PRACTICE_CITY,
    env.EQUISMILE_PRACTICE_IBAN,
  ];
  const allSet = required.every((v): v is string => !!v && v.length > 0);
  if (!allSet) {
    if (env.DEMO_MODE === 'true') return DEMO_CREDITOR;
    throw new Error(
      'EQUISMILE_PRACTICE_{NAME,ADDRESS,ZIP,CITY,IBAN} env vars must be set ' +
        'to render a Swiss QR-bill outside DEMO_MODE.',
    );
  }
  return {
    name: env.EQUISMILE_PRACTICE_NAME!,
    address: env.EQUISMILE_PRACTICE_ADDRESS!,
    buildingNumber: env.EQUISMILE_PRACTICE_BUILDING ?? undefined,
    zip: env.EQUISMILE_PRACTICE_ZIP!,
    city: env.EQUISMILE_PRACTICE_CITY!,
    country: env.EQUISMILE_PRACTICE_COUNTRY ?? 'CH',
    account: env.EQUISMILE_PRACTICE_IBAN!,
  };
}

function toAmount(amount: Prisma.Decimal | number | string): number {
  if (typeof amount === 'number') return amount;
  if (typeof amount === 'string') return parseFloat(amount);
  return parseFloat(amount.toFixed(2));
}

/**
 * Render the Swiss QR-bill payment part for an invoice as a PDF
 * Buffer. Caller streams it back as `application/pdf`.
 */
export async function renderQRBillPdf(input: RenderQRBillInput): Promise<Buffer> {
  // The QR-bill spec requires the debtor block to be either fully
  // populated (name + address + zip + city + country) or entirely
  // omitted. We only attach a debtor when we have all four address
  // fields; otherwise customers without billing addresses still get
  // a valid QR-bill that the customer can complete by hand.
  const debtorComplete =
    input.debtor &&
    input.debtor.name &&
    input.debtor.address &&
    input.debtor.zip &&
    input.debtor.city;
  const data: QRBillData = {
    amount: toAmount(input.amount),
    currency: (input.currency as 'CHF' | 'EUR') ?? 'CHF',
    creditor: input.creditor,
    ...(debtorComplete ? { debtor: input.debtor as QRBillData['debtor'] } : {}),
    reference: input.reference ?? undefined,
    message: input.message ?? `Invoice ${input.invoiceNumber}`,
  };

  const doc = new PDFDocument({ autoFirstPage: true, size: 'A4' });
  const qrBill = new SwissQRBill(data);

  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Optional: render an invoice header above the payment part so
    // the operator has context. Keep it minimal; real branded
    // templates can replace this in a follow-up.
    // Optional: render an invoice header above the payment part so
    // the operator has context. The logo is loaded from public/logo.png
    // when present — until the real asset lands, falls back to a
    // styled-text wordmark in the brand maroon (#9b214d).
    const logoPng = loadLogoPng();
    if (logoPng) {
      doc.image(logoPng, 50, 40, { fit: [120, 30] });
    } else {
      doc.fontSize(22).fillColor('#9b214d').text(BRAND_NAME, 50, 45, { oblique: 15 });
      doc.fillColor('black');
    }
    doc.fontSize(10).text(`Invoice ${input.invoiceNumber}`, 50, 80);
    doc.text(`Amount: ${data.currency} ${(data.amount ?? 0).toFixed(2)}`, 50, 95);
    if (input.debtor?.name) {
      doc.text(`Customer: ${input.debtor.name}`, 50, 110);
    }

    qrBill.attachTo(doc);
    doc.end();
  });
}
