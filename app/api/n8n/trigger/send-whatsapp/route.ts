import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { verifyN8nApiKey } from '@/lib/utils/signature';
import { whatsappService } from '@/lib/services/whatsapp.service';

const sendWhatsAppSchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1),
  enquiryId: z.string().uuid().optional(),
  language: z.string().optional().default('en'),
  templateName: z.string().optional(),
  templateParams: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (env.N8N_API_KEY && !verifyN8nApiKey(authHeader, env.N8N_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
