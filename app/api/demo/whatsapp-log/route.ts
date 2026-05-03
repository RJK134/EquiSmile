/**
 * GET /api/demo/whatsapp-log
 *
 * Returns the most recent outbound WhatsApp messages for the demo
 * UI's "Sent WhatsApp messages" panel. Demo-mode-only — production
 * deployments shouldn't expose message bodies on an unauthenticated
 * endpoint, so the route returns 403 outside DEMO_MODE.
 *
 * Used by app/[locale]/demo/components/WhatsAppMessageLog.tsx to
 * close the loop on the demo persona's "I sent a confirmation —
 * where did it go?" question.
 */

import { NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo/demo-mode';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const TEMPLATE_PREFIX = '[Template:';

interface LoggedMessage {
  id: string;
  to: string;
  body: string;
  templateName: string | null;
  externalMessageId: string | null;
  timestamp: string;
}

/**
 * The simulator records template sends with the body shape
 *   `[Template: <name>] <comma-separated params>`
 * so the demo UI can show the template name as a separate label
 * rather than mixing it into the rendered body.
 */
function extractTemplate(body: string): { templateName: string | null; renderedBody: string } {
  if (!body.startsWith(TEMPLATE_PREFIX)) {
    return { templateName: null, renderedBody: body };
  }
  const closeBracket = body.indexOf(']');
  if (closeBracket < 0) return { templateName: null, renderedBody: body };
  const templateName = body.slice(TEMPLATE_PREFIX.length, closeBracket).trim();
  const renderedBody = body.slice(closeBracket + 1).trim();
  return { templateName, renderedBody };
}

export async function GET() {
  if (!isDemoMode()) {
    return NextResponse.json({ error: 'Demo-only endpoint' }, { status: 403 });
  }

  const rows = await prisma.enquiryMessage.findMany({
    where: { direction: 'OUTBOUND', channel: 'WHATSAPP' },
    orderBy: { sentOrReceivedAt: 'desc' },
    take: 20,
    include: {
      enquiry: {
        select: {
          customer: { select: { mobilePhone: true, fullName: true } },
        },
      },
    },
  });

  const messages: LoggedMessage[] = rows.map((row) => {
    const { templateName, renderedBody } = extractTemplate(row.messageText);
    return {
      id: row.id,
      to:
        row.enquiry?.customer?.mobilePhone ??
        row.enquiry?.customer?.fullName ??
        'unknown',
      body: renderedBody,
      templateName,
      externalMessageId: row.externalMessageId,
      timestamp: row.sentOrReceivedAt.toISOString(),
    };
  });

  return NextResponse.json({ messages });
}
