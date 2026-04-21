import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { verifyN8nApiKey } from '@/lib/utils/signature';
import { emailService } from '@/lib/services/email.service';
import { enforceRequestRateLimit } from '@/lib/security/rate-limit';
import { logger } from '@/lib/utils/logger';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  enquiryId: z.string().uuid().optional(),
  language: z.string().optional().default('en'),
  html: z.string().optional(),
});

export async function POST(request: NextRequest) {
  enforceRequestRateLimit(request, 'n8n-send-email', 40, 60_000);
  const authHeader = request.headers.get('authorization');
  if (!env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
  if (!verifyN8nApiKey(authHeader, env.N8N_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = sendEmailSchema.parse(body);

    logger.info('n8n send email triggered', { to: payload.to, subject: payload.subject });

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
