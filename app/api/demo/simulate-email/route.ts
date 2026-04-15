import { NextRequest, NextResponse } from 'next/server';
import { requireDemoMode } from '@/lib/demo/demo-mode';
import { generateInboundEmail } from '@/lib/demo/email-simulator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const guard = requireDemoMode();
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  let body: { language?: 'en' | 'fr' } = {};
  try {
    body = await request.json();
  } catch {
    // Use defaults
  }

  const language = body.language === 'fr' ? 'fr' : 'en';
  const email = generateInboundEmail(language);

  return NextResponse.json({
    success: true,
    simulation: 'email-inbound',
    language,
    email,
  });
}
