/**
 * POST /api/triage-ops/classify — Trigger auto-triage on an enquiry.
 *
 * Originally documented as being called by the n8n triage-enrichment
 * workflow (03-triage-enrichment.json). In practice the n8n-to-app
 * path uses `/api/n8n/triage-result` (server-to-server, API-key
 * auth), while this endpoint is the UI-triggered version. Now locked
 * to NURSE+ — running the classifier is a clinical-routing decision.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { autoTriageService } from '@/lib/services/auto-triage.service';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

export async function POST(request: NextRequest) {
  try {
    await requireRole(ROLES.NURSE);
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
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
