import { NextRequest } from 'next/server';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { routeProposalService } from '@/lib/services/route-proposal.service';
import { z } from 'zod';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

const generateSchema = z.object({
  targetDate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole(ROLES.VET);
    const body = await request.json().catch(() => ({}));
    const { targetDate } = generateSchema.parse(body);

    const proposals = await routeProposalService.generateProposals(targetDate);

    return successResponse({
      success: true,
      proposalCount: proposals.length,
      proposals,
    }, 201);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
