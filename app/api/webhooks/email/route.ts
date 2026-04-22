import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { normaliseEmail } from '@/lib/utils/email';
import { parseMessage } from '@/lib/utils/message-parser';
import { messageLogService } from '@/lib/services/message-log.service';
import { autoTriageService } from '@/lib/services/auto-triage.service';
import { rateLimiter, rateLimitedResponse, clientKeyFromRequest } from '@/lib/utils/rate-limit';

// n8n typically batches a handful of emails per minute; cap generously
// at 200/min per IP to catch misconfigured loops.
const emailWebhookLimiter = rateLimiter({ windowMs: 60_000, max: 200 });

// ---------------------------------------------------------------------------
// Validation schema for email intake payload
// ---------------------------------------------------------------------------

const emailPayloadSchema = z.object({
  from: z.string().min(1),
  fromName: z.string().optional(),
  subject: z.string(),
  textBody: z.string(),
  htmlBody: z.string().optional(),
  messageId: z.string().min(1),
  inReplyTo: z.string().optional(),
  receivedAt: z.string(),
});

type EmailPayload = z.infer<typeof emailPayloadSchema>;

// ---------------------------------------------------------------------------
// POST — Email intake from n8n IMAP trigger
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Per-IP rate limit first so burst abuse doesn't burn CPU on
  // signature/parse work.
  const decision = emailWebhookLimiter.check(clientKeyFromRequest(request, 'email-wh'));
  if (!decision.allowed) return rateLimitedResponse(decision);

  // Authenticate with n8n API key — FAIL CLOSED in production if no key
  // is configured (otherwise this endpoint would accept anonymous email
  // payloads that create customers + enquiries and trigger auto-triage).
  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  let payload: EmailPayload;
  try {
    const body = await request.json();
    payload = emailPayloadSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Deduplicate by external message ID
  const existing = await prisma.enquiry.findUnique({
    where: { externalMessageId: payload.messageId },
  });
  if (existing) {
    return NextResponse.json({
      success: true,
      enquiryId: existing.id,
      customerId: existing.customerId,
      isNew: false,
    });
  }

  const email = normaliseEmail(payload.from);
  const receivedAt = new Date(payload.receivedAt);

  // Match or create customer by email
  let customer = await prisma.customer.findUnique({
    where: { email },
  });
  let isNewCustomer = false;

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        fullName: payload.fromName || email,
        email,
        preferredChannel: 'EMAIL',
        preferredLanguage: 'en',
      },
    });
    isNewCustomer = true;
    console.log('[Email] Created new customer', { customerId: customer.id });
  } else if (customer.deletedAt) {
    // Phase 15 — the unique email/phone constraints still apply to
    // tombstoned rows, so a returning customer is routed here. Restore
    // them automatically (a new inbound message is strong signal of
    // live relationship) and record it so the operator can audit.
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { deletedAt: null, deletedById: null },
    });
    console.log('[Email] Restored soft-deleted customer on inbound message', {
      customerId: customer.id,
    });
  }

  // Derive thread key from In-Reply-To or Message-ID
  const threadKey = payload.inReplyTo
    ? `email:${payload.inReplyTo}`
    : `email:${payload.messageId}`;

  // Parse message for structured info
  const parsed = parseMessage(payload.textBody);

  // Create enquiry
  const enquiry = await prisma.enquiry.create({
    data: {
      channel: 'EMAIL',
      externalMessageId: payload.messageId,
      customerId: customer.id,
      sourceFrom: email,
      subject: payload.subject || null,
      rawText: payload.textBody,
      receivedAt,
      threadKey,
      triageStatus: 'NEW',
    },
  });

  // Log inbound message
  await messageLogService.logMessage({
    enquiryId: enquiry.id,
    direction: 'INBOUND',
    channel: 'EMAIL',
    messageText: payload.textBody,
    sentOrReceivedAt: receivedAt,
    externalMessageId: payload.messageId,
  });

  // Create visit request
  const visitRequest = await prisma.visitRequest.create({
    data: {
      enquiryId: enquiry.id,
      customerId: customer.id,
      requestType: parsed.isUrgent ? 'URGENT_ISSUE' : 'ROUTINE_DENTAL',
      urgencyLevel: parsed.isUrgent ? 'URGENT' : 'ROUTINE',
      horseCount: parsed.horseCount,
      needsMoreInfo: true,
      planningStatus: 'UNTRIAGED',
      preferredDays: [],
      preferredTimeBand: 'ANY',
    },
  });

  // Run auto-triage rules
  let triageResult;
  try {
    triageResult = await autoTriageService.triageEnquiry(
      enquiry.id,
      visitRequest.id,
      payload.textBody,
    );
    console.log('[Email] Auto-triage completed', {
      enquiryId: enquiry.id,
      urgency: triageResult.urgency,
      confidence: triageResult.confidence,
    });
  } catch (triageErr) {
    console.error('[Email] Auto-triage failed, enquiry still created', triageErr);
  }

  console.log('[Email] Enquiry created', {
    enquiryId: enquiry.id,
    customerId: customer.id,
    isNewCustomer,
    subject: payload.subject,
  });

  return NextResponse.json({
    success: true,
    enquiryId: enquiry.id,
    customerId: customer.id,
    visitRequestId: visitRequest.id,
    isNew: isNewCustomer,
    triage: triageResult ? {
      urgency: triageResult.urgency,
      requestType: triageResult.requestType,
      confidence: triageResult.confidence,
    } : null,
  });
}
