import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';
import { whatsappService } from '@/lib/services/whatsapp.service';

const sendWhatsAppSchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1),
  enquiryId: z.string().uuid().optional(),
  language: z.string().optional().default('en'),
  templateName: z.string().optional(),
  templateParams: z.array(z.string()).optional(),
});

// Outbound WhatsApp is billable. Cap per-IP to catch runaway loops
// before they burn Meta credits.
const limiter = rateLimiter({ windowMs: 60_000, max: 60 });

export async function POST(request: NextRequest) {
  const rl = limiter.check(clientKeyFromRequest(request, 'n8n-wa'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const payload = sendWhatsAppSchema.parse(body);

    console.log('[n8n] Send WhatsApp triggered', { to: payload.to, enquiryId: payload.enquiryId });

    let result;
    if (payload.templateName) {
      result = await whatsappService.sendTemplateMessage(
        payload.to,
        payload.templateName,
        payload.language,
        payload.templateParams || [],
        payload.enquiryId
      );
    } else {
      result = await whatsappService.sendTextMessage(
        payload.to,
        payload.message,
        payload.enquiryId,
        payload.language
      );
    }

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
