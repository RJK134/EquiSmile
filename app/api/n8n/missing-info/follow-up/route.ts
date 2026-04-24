/**
 * POST /api/n8n/missing-info/follow-up
 *
 * n8n-authenticated mirror of the NURSE-session-gated
 * `/api/triage-ops/follow-up` POST endpoint. Used by workflow
 * 03-triage-enrichment.json to fire the follow-up customer message
 * when triage flags missing information.
 *
 * Auth: `N8N_API_KEY` Bearer token. Fail-closed in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { missingInfoService } from '@/lib/services/missing-info.service';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';

const schema = z.object({
  visitRequestId: z.string().uuid(),
});

// Follow-ups are outbound customer messaging — cap per-IP tighter than
// internal callbacks so a misconfigured loop can't burn Meta credits.
const limiter = rateLimiter({ windowMs: 60_000, max: 60 });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = limiter.check(clientKeyFromRequest(request, 'n8n-follow-up'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const { visitRequestId } = schema.parse(body);
    const result = await missingInfoService.sendFollowUp(visitRequestId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
