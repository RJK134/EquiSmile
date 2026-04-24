/**
 * POST /api/n8n/route-planning/generate
 *
 * n8n-authenticated mirror of the VET-session-gated
 * `/api/route-planning/generate` endpoint. Used by workflow
 * 05-route-planning.json when a scheduled trigger asks the app to
 * regenerate proposals.
 *
 * Auth: `N8N_API_KEY` Bearer token. Fail-closed in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { routeProposalService } from '@/lib/services/route-proposal.service';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';

const schema = z.object({
  targetDate: z.string().optional(),
});

const limiter = rateLimiter({ windowMs: 60_000, max: 30 });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = limiter.check(clientKeyFromRequest(request, 'n8n-route-plan'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { targetDate } = schema.parse(body);
    const proposals = await routeProposalService.generateProposals(targetDate);
    return NextResponse.json({
      success: true,
      proposalCount: proposals.length,
      proposals,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
