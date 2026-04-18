/**
 * POST /api/triage-ops/classify — Trigger auto-triage on an enquiry
 *
 * Called by the n8n triage-enrichment workflow (03-triage-enrichment.json).
 * Expects { enquiryId } in body. Looks up the enquiry's visit request
 * and runs the rules engine.
 */

import { NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { autoTriageService } from '@/lib/services/auto-triage.service';
import { verifyN8nApiKey } from '@/lib/utils/signature';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (env.N8N_API_KEY && !verifyN8nApiKey(authHeader, env.N8N_API_KEY)) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json();
    const { enquiryId } = body as { enquiryId?: string };

    if (!enquiryId) {
      return new Response(
        JSON.stringify({ error: 'enquiryId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: {
        visitRequests: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!enquiry) {
      return new Response(
        JSON.stringify({ error: 'Enquiry not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const visitRequest = enquiry.visitRequests[0];
    if (!visitRequest) {
      return new Response(
        JSON.stringify({ error: 'No visit request found for this enquiry' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const result = await autoTriageService.triageEnquiry(
      enquiryId,
      visitRequest.id,
      enquiry.rawText,
    );

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
