import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { normaliseEmail } from '@/lib/utils/email';
import { parseMessage } from '@/lib/utils/message-parser';
import { messageLogService } from '@/lib/services/message-log.service';
import { autoTriageService } from '@/lib/services/auto-triage.service';
import { rateLimiter, rateLimitedResponse, clientKeyFromRequest } from '@/lib/utils/rate-limit';
import { logger } from '@/lib/utils/logger';

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

  // Match or create customer by email. Use upsert so concurrent inbound
  // emails for the same sender do not race into a unique-constraint error.
  const createdCustomerId = randomUUID();
  const customer = await prisma.customer.upsert({
    where: { email },
    update: {},
    create: {
      id: createdCustomerId,
      fullName: payload.fromName || email,
      email,
      preferredChannel: 'EMAIL',
      preferredLanguage: 'en',
    },
  });
  const isNewCustomer = customer.id === createdCustomerId;

  if (isNewCustomer) {
    logger.info('Email intake created new customer', {
      service: 'email-webhook',
      operation: 'create-customer',
      customerId: customer.id,
      email,
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
    logger.info('Email auto-triage completed', {
      service: 'email-webhook',
      operation: 'auto-triage',
      enquiryId: enquiry.id,
      urgency: triageResult.urgency,
      confidence: triageResult.confidence,
    });
  } catch (triageErr) {
    logger.error('Email auto-triage failed; enquiry still created', triageErr, {
      service: 'email-webhook',
      operation: 'auto-triage',
      enquiryId: enquiry.id,
      visitRequestId: visitRequest.id,
    });
  }

  logger.info('Email enquiry created', {
    service: 'email-webhook',
    operation: 'create-enquiry',
    enquiryId: enquiry.id,
    customerId: customer.id,
    isNewCustomer,
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
