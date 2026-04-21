import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';
import { whatsappService } from '@/lib/services/whatsapp.service';
import { emailService } from '@/lib/services/email.service';

const limiter = rateLimiter({ windowMs: 60_000, max: 60 });

const requestInfoSchema = z.object({
  enquiryId: z.string().uuid(),
  customerId: z.string().uuid(),
  missingFields: z.array(z.string()).min(1),
  channel: z.enum(['WHATSAPP', 'EMAIL']).optional(),
  language: z.string().optional().default('en'),
});

const INFO_PROMPTS_EN: Record<string, string> = {
  postcode: 'Could you please provide the postcode of the yard where your horse(s) are kept?',
  horseCount: 'How many horses need to be seen?',
  preferredDays: 'Which days of the week work best for a visit?',
  symptoms: 'Could you describe the symptoms you\'re seeing in more detail?',
  yardName: 'What is the name of the yard?',
};

const INFO_PROMPTS_FR: Record<string, string> = {
  postcode: 'Pourriez-vous fournir le code postal de l\'écurie où se trouvent vos chevaux ?',
  horseCount: 'Combien de chevaux doivent être examinés ?',
  preferredDays: 'Quels jours de la semaine vous conviendraient le mieux pour une visite ?',
  symptoms: 'Pourriez-vous décrire les symptômes que vous observez plus en détail ?',
  yardName: 'Quel est le nom de l\'écurie ?',
};

export async function POST(request: NextRequest) {
  const rl = limiter.check(clientKeyFromRequest(request, 'n8n-req-info'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const payload = requestInfoSchema.parse(body);

    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const lang = payload.language || customer.preferredLanguage || 'en';
    const prompts = lang === 'fr' ? INFO_PROMPTS_FR : INFO_PROMPTS_EN;
    const greeting = lang === 'fr' ? 'Bonjour' : 'Hello';
    const intro = lang === 'fr'
      ? 'Pour mieux traiter votre demande, nous aurions besoin des informations suivantes :'
      : 'To better process your enquiry, we need the following information:';

    const questions = payload.missingFields
      .map((field) => prompts[field] || field)
      .join('\n• ');
    const messageText = `${greeting} ${customer.fullName},\n\n${intro}\n• ${questions}`;

    const channel = payload.channel || customer.preferredChannel;
    let result;

    if (channel === 'WHATSAPP' && customer.mobilePhone) {
      result = await whatsappService.sendTextMessage(
        customer.mobilePhone,
        messageText,
        payload.enquiryId,
        lang
      );
    } else if (customer.email) {
      const subject = lang === 'fr' ? 'EquiSmile — Informations complémentaires nécessaires' : 'EquiSmile — Additional Information Needed';
      result = await emailService.sendBrandedEmail(
        customer.email,
        subject,
        messageText,
        lang,
        payload.enquiryId
      );
    } else {
      return NextResponse.json({
        success: false,
        message: 'No contact method available for customer',
      }, { status: 422 });
    }

    console.log('[n8n] Request info sent', {
      enquiryId: payload.enquiryId,
      channel,
      missingFields: payload.missingFields,
    });

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      channel,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
