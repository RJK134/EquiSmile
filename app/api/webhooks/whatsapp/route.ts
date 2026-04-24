import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { verifyWhatsAppSignature, verifyWhatsAppVerifyToken } from '@/lib/utils/signature';
import { normalisePhone } from '@/lib/utils/phone';
import { parseMessage } from '@/lib/utils/message-parser';
import { messageLogService } from '@/lib/services/message-log.service';
import { autoTriageService } from '@/lib/services/auto-triage.service';
import { rateLimiter, rateLimitedResponse, clientKeyFromRequest } from '@/lib/utils/rate-limit';
import { logger } from '@/lib/utils/logger';

// Per-IP cap: Meta typically pushes <60 req/min per app. 300/min is an
// order-of-magnitude headroom that still catches a misconfigured
// retry storm or a spoofed edge.
const whatsappWebhookLimiter = rateLimiter({ windowMs: 60_000, max: 300 });

// ---------------------------------------------------------------------------
// GET — Webhook verification (Meta sends this during setup)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && verifyWhatsAppVerifyToken(token, env.WHATSAPP_VERIFY_TOKEN)) {
    logger.info('WhatsApp webhook verified', {
      service: 'whatsapp-webhook',
      operation: 'verify-webhook',
    });
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn('WhatsApp webhook verification failed', {
    service: 'whatsapp-webhook',
    operation: 'verify-webhook',
    mode,
    token: token ? 'present' : 'missing',
  });
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — Incoming webhook events
// ---------------------------------------------------------------------------

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

interface WhatsAppChange {
  value: {
    messaging_product: string;
    metadata: { display_phone_number: string; phone_number_id: string };
    contacts?: WhatsAppContact[];
    messages?: WhatsAppMessage[];
    statuses?: unknown[];
  };
  field: string;
}

interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

interface WhatsAppPayload {
  object: string;
  entry: WhatsAppEntry[];
}

export async function POST(request: NextRequest) {
  // Per-IP rate limit first — cheap and stops obvious abuse before we
  // parse a potentially-large body.
  const decision = whatsappWebhookLimiter.check(clientKeyFromRequest(request, 'wa-wh'));
  if (!decision.allowed) return rateLimitedResponse(decision);

  // Read raw body for signature verification
  const rawBody = await request.text();

  // Verify signature — fail loudly in production if app secret is missing
  const isDemo = env.DEMO_MODE === 'true';
  if (!env.WHATSAPP_APP_SECRET && !isDemo) {
    logger.error(
      'WhatsApp webhook rejected because signature verification is unavailable',
      undefined,
      {
        service: 'whatsapp-webhook',
        operation: 'verify-signature',
      },
    );
    return NextResponse.json(
      { error: 'Server misconfiguration: WHATSAPP_APP_SECRET is required for webhook signature verification' },
      { status: 500 },
    );
  }

  if (env.WHATSAPP_APP_SECRET) {
    const signature = request.headers.get('x-hub-signature-256') || '';
    if (!verifyWhatsAppSignature(rawBody, signature, env.WHATSAPP_APP_SECRET)) {
      logger.warn('WhatsApp webhook signature verification failed', {
        service: 'whatsapp-webhook',
        operation: 'verify-signature',
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: WhatsAppPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Must respond 200 quickly — Meta requires fast acknowledgment
  // Process asynchronously but don't await
  processWebhookPayload(payload).catch((err) => {
    logger.error('WhatsApp webhook processing failed', err, {
      service: 'whatsapp-webhook',
      operation: 'process-payload',
    });
  });

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

async function processWebhookPayload(payload: WhatsAppPayload) {
  if (payload.object !== 'whatsapp_business_account') {
    logger.info('Ignoring non-WhatsApp webhook payload', {
      service: 'whatsapp-webhook',
      operation: 'process-payload',
      object: payload.object,
    });
    return;
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;
      const { messages, contacts } = change.value;

      // Skip non-message events (status updates, read receipts)
      if (!messages || messages.length === 0) continue;

      for (const message of messages) {
        // Only process text messages for now
        if (message.type !== 'text' || !message.text?.body) {
          logger.info('Skipping non-text WhatsApp message', {
            service: 'whatsapp-webhook',
            operation: 'process-message',
            type: message.type,
            messageId: message.id,
          });
          continue;
        }

        const senderPhone = normalisePhone(message.from);
        const contact = contacts?.find((c) => c.wa_id === message.from);
        const senderName = contact?.profile?.name || message.from;
        const messageText = message.text.body;
        const timestamp = new Date(parseInt(message.timestamp) * 1000);

        logger.info('Processing WhatsApp message', {
          service: 'whatsapp-webhook',
          operation: 'process-message',
          messageId: message.id,
          from: message.from,
          timestamp: timestamp.toISOString(),
        });

        // Deduplicate by external message ID
        const existing = await prisma.enquiry.findUnique({
          where: { externalMessageId: message.id },
        });
        if (existing) {
          logger.info('Skipping duplicate WhatsApp message', {
            service: 'whatsapp-webhook',
            operation: 'process-message',
            messageId: message.id,
          });
          continue;
        }

        // Match or create customer by phone
        let customer = senderPhone
          ? await prisma.customer.findUnique({ where: { mobilePhone: senderPhone } })
          : null;

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              fullName: senderName,
              mobilePhone: senderPhone,
              preferredChannel: 'WHATSAPP',
              preferredLanguage: 'en',
            },
          });
          logger.info('WhatsApp intake created new customer', {
            service: 'whatsapp-webhook',
            operation: 'create-customer',
            customerId: customer.id,
            mobilePhone: senderPhone,
          });
        }

        // Parse message for structured info
        const parsed = parseMessage(messageText);

        // Create enquiry
        const enquiry = await prisma.enquiry.create({
          data: {
            channel: 'WHATSAPP',
            externalMessageId: message.id,
            customerId: customer.id,
            sourceFrom: message.from,
            rawText: messageText,
            receivedAt: timestamp,
            triageStatus: 'NEW',
            threadKey: `wa:${message.from}`,
          },
        });

        // Create inbound message log
        await messageLogService.logMessage({
          enquiryId: enquiry.id,
          direction: 'INBOUND',
          channel: 'WHATSAPP',
          messageText,
          sentOrReceivedAt: timestamp,
          externalMessageId: message.id,
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
        try {
          const triageResult = await autoTriageService.triageEnquiry(
            enquiry.id,
            visitRequest.id,
            messageText,
          );
          logger.info('WhatsApp auto-triage completed', {
            service: 'whatsapp-webhook',
            operation: 'auto-triage',
            enquiryId: enquiry.id,
            urgency: triageResult.urgency,
            confidence: triageResult.confidence,
            tasksCreated: triageResult.tasksCreated.length,
          });
        } catch (triageErr) {
          logger.error('WhatsApp auto-triage failed; enquiry still created', triageErr, {
            service: 'whatsapp-webhook',
            operation: 'auto-triage',
            enquiryId: enquiry.id,
            visitRequestId: visitRequest.id,
          });
        }

        logger.info('WhatsApp enquiry created', {
          service: 'whatsapp-webhook',
          operation: 'create-enquiry',
          enquiryId: enquiry.id,
          customerId: customer.id,
          isUrgent: parsed.isUrgent,
        });
      }
    }
  }
}
