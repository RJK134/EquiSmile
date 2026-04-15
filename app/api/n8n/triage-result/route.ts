import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { verifyN8nApiKey } from '@/lib/utils/signature';

const triageResultSchema = z.object({
  enquiryId: z.string().uuid(),
  visitRequestId: z.string().uuid(),
  requestType: z.enum(['ROUTINE_DENTAL', 'FOLLOW_UP', 'URGENT_ISSUE', 'FIRST_VISIT', 'ADMIN']),
  urgencyLevel: z.enum(['URGENT', 'SOON', 'ROUTINE']),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (env.N8N_API_KEY && !verifyN8nApiKey(authHeader, env.N8N_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = triageResultSchema.parse(body);

    console.log('[n8n] Triage result received', {
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
