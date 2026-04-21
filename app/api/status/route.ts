import { NextResponse } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { isDemoMode } from '@/lib/demo/demo-mode';
import { googleMapsClient } from '@/lib/integrations/google-maps.client';
import { whatsappClient } from '@/lib/integrations/whatsapp.client';
import { smtpClient } from '@/lib/integrations/smtp.client';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireActorWithRole(['admin']);
  return NextResponse.json({
    demoMode: isDemoMode(),
    integrations: {
      googleMaps: googleMapsClient.getMode(),
      whatsapp: whatsappClient.getMode(),
      smtp: smtpClient.getMode(),
    },
    env: {
      DEMO_MODE: process.env.DEMO_MODE ?? '(unset)',
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ? 'set' : 'missing',
      GCP_PROJECT_ID: process.env.GCP_PROJECT_ID ? 'set' : 'missing',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ? 'set' : 'missing',
      WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ? 'set' : 'missing',
      WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET ? 'set' : 'missing',
      SMTP_HOST: process.env.SMTP_HOST ? 'set' : 'missing',
      SMTP_USER: process.env.SMTP_USER ? 'set' : 'missing',
      SMTP_PASSWORD: process.env.SMTP_PASSWORD ? 'set' : 'missing',
    },
    timestamp: new Date().toISOString(),
  });
}
