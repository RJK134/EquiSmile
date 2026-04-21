import { NextRequest, NextResponse } from 'next/server';
import { requireActorWithRole } from '@/lib/auth/api';
import { requireDemoMode } from '@/lib/demo/demo-mode';
import { generateInboundEmail } from '@/lib/demo/email-simulator';
import { securityAuditService } from '@/lib/services/security-audit.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const actor = await requireActorWithRole(['admin']);
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

  await securityAuditService.log({
    action: 'demo.simulate-email',
    entityType: 'demo',
    actor,
    details: { language },
  });

  return NextResponse.json({
    success: true,
    simulation: 'email-inbound',
    language,
    email,
  });
}
