/**
 * POST /api/n8n/triage/classify
 *
 * n8n-authenticated mirror of the NURSE-session-gated
 * `/api/triage-ops/classify` endpoint. Used by workflow
 * 03-triage-enrichment.json when n8n re-runs the app's internal
 * rules engine (e.g. after enrichment has augmented the visit request
 * with extra data).
 *
 * Auth: `N8N_API_KEY` Bearer token. Fail-closed in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { autoTriageService } from '@/lib/services/auto-triage.service';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';

const schema = z.object({
  enquiryId: z.string().uuid(),
});

const limiter = rateLimiter({ windowMs: 60_000, max: 120 });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = limiter.check(clientKeyFromRequest(request, 'n8n-triage-classify'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const { enquiryId } = schema.parse(body);

    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: { visitRequests: { take: 1, orderBy: { createdAt: 'desc' } } },
    });

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    const visitRequest = enquiry.visitRequests[0];
    if (!visitRequest) {
      return NextResponse.json(
        { error: 'No visit request found for this enquiry' },
        { status: 404 },
      );
    }

    const result = await autoTriageService.triageEnquiry(
      enquiryId,
      visitRequest.id,
      enquiry.rawText,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
