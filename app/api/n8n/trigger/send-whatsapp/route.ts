import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { whatsappService } from '@/lib/services/whatsapp.service';
import { enforceRequestRateLimit } from '@/lib/security/rate-limit';
import { logger } from '@/lib/utils/logger';
import { assertN8nRequest } from '@/lib/utils/n8n-auth';
import { handleApiError } from '@/lib/api-utils';

const sendWhatsAppSchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1),
  enquiryId: z.string().uuid().optional(),
  language: z.string().optional().default('en'),
  templateName: z.string().optional(),
  templateParams: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    enforceRequestRateLimit(request, 'n8n-send-whatsapp', 40, 60_000);
    assertN8nRequest(request);
    const body = await request.json();
    const payload = sendWhatsAppSchema.parse(body);

    logger.info('n8n send WhatsApp triggered', { to: payload.to, enquiryId: payload.enquiryId });

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
    return handleApiError(error);
  }
}
