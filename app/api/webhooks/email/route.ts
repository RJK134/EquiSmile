import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { normaliseEmail } from '@/lib/utils/email';
import { parseMessage } from '@/lib/utils/message-parser';
import { messageLogService } from '@/lib/services/message-log.service';
import { autoTriageService } from '@/lib/services/auto-triage.service';
import { enforceRequestRateLimit } from '@/lib/security/rate-limit';
import { logger } from '@/lib/utils/logger';
import { assertN8nRequest } from '@/lib/utils/n8n-auth';
import { handleApiError } from '@/lib/api-utils';

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
  let payload: EmailPayload;
  try {
    enforceRequestRateLimit(request, 'webhook-email', 60, 60_000);
    assertN8nRequest(request);
    const body = await request.json();
    payload = emailPayloadSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    return handleApiError(error);
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
    logger.info('Email webhook created customer', { customerId: customer.id, email });
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
      enquiryId: enquiry.id,
      urgency: triageResult.urgency,
      confidence: triageResult.confidence,
    });
  } catch (triageErr) {
    logger.error('Email auto-triage failed', triageErr, {
      enquiryId: enquiry.id,
    });
  }

  logger.info('Email enquiry created', {
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
