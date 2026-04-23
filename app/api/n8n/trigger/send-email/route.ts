import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';
import { emailService } from '@/lib/services/email.service';
import { maskEmail } from '@/lib/utils/logger';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  enquiryId: z.string().uuid().optional(),
  language: z.string().optional().default('en'),
  html: z.string().optional(),
});

const limiter = rateLimiter({ windowMs: 60_000, max: 60 });

export async function POST(request: NextRequest) {
  const rl = limiter.check(clientKeyFromRequest(request, 'n8n-email'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const payload = sendEmailSchema.parse(body);

    console.log('[n8n] Send email triggered', { to: maskEmail(payload.to), subject: payload.subject });

    const result = await emailService.sendEmail({
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
      html: payload.html,
      enquiryId: payload.enquiryId,
      language: payload.language,
    });

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
