import { NextRequest, NextResponse } from 'next/server';
import { requireDemoMode } from '@/lib/demo/demo-mode';
import { generateInboundPayload, DEMO_CONTACTS } from '@/lib/demo/whatsapp-simulator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const guard = requireDemoMode();
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  let body: { language?: 'en' | 'fr'; message?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Use defaults
  }

  const language = body.language === 'fr' ? 'fr' : 'en';
  const payload = generateInboundPayload(language, body.message);
  const contact = DEMO_CONTACTS[language];

  return NextResponse.json({
    success: true,
    simulation: 'whatsapp-inbound',
    language,
    from: contact.phone,
    name: contact.name,
    payload,
  });
}
