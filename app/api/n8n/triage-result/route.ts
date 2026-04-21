import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { verifyN8nApiKey } from '@/lib/utils/signature';
import { enforceRequestRateLimit } from '@/lib/security/rate-limit';
import { logger } from '@/lib/utils/logger';

const triageResultSchema = z.object({
  enquiryId: z.string().uuid(),
  visitRequestId: z.string().uuid(),
  requestType: z.enum(['ROUTINE_DENTAL', 'FOLLOW_UP', 'URGENT_ISSUE', 'FIRST_VISIT', 'ADMIN']),
  urgencyLevel: z.enum(['URGENT', 'SOON', 'ROUTINE']),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
});

export async function POST(request: NextRequest) {
  enforceRequestRateLimit(request, 'n8n-triage-result', 60, 60_000);
  const authHeader = request.headers.get('authorization');
  if (!env.N8N_API_KEY) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
  if (!verifyN8nApiKey(authHeader, env.N8N_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = triageResultSchema.parse(body);

    logger.info('n8n triage result received', {
      enquiryId: payload.enquiryId,
      visitRequestId: payload.visitRequestId,
      requestType: payload.requestType,
      urgencyLevel: payload.urgencyLevel,
    });

    // Placeholder: will be fully implemented in Phase 4 (triage rules engine)
    return NextResponse.json({
      success: true,
      message: 'Triage result acknowledged',
      data: payload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
