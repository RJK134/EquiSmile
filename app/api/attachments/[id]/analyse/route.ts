import { NextRequest } from 'next/server';
import { visionAnalysisService } from '@/lib/services/vision-analysis.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';

/**
 * POST /api/attachments/[id]/analyse
 * Body: { staffId?: string, persist?: boolean }
 *
 * Sends the attachment to Claude for structured clinical analysis and
 * (by default) persists the result as a DentalChart + ClinicalFindings
 * (+ draft Prescriptions) on the horse. VET+ only — nurses can view
 * attachments but should not invoke a paid, clinical-judgement-adjacent
 * model run.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let subject: Awaited<ReturnType<typeof requireRole>>;
  try {
    subject = await requireRole(ROLES.VET);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }

  try {
    const { id } = await context.params;

    const body = await safeJson(request);
    const staffId = typeof body.staffId === 'string' ? body.staffId : null;
    const persist = body.persist === false ? false : true;

    if (!process.env.ANTHROPIC_API_KEY) {
      return errorResponse(
        'Vision analysis unavailable: ANTHROPIC_API_KEY is not configured on the server.',
        503,
      );
    }

    const output = await visionAnalysisService.analyseAttachment({
      attachmentId: id,
      staffId,
      persist,
    });

    await securityAuditService.record({
      event: 'VISION_ANALYSIS_INVOKED',
      actor: subject,
      targetType: 'HorseAttachment',
      targetId: id,
      detail: `persist=${persist}; findings=${output.findingIds.length}; prescriptions=${output.prescriptionIds.length}`,
    });

    return successResponse(output, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

async function safeJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
