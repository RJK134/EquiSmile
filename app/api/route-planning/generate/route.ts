import { NextRequest } from 'next/server';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { routeProposalService } from '@/lib/services/route-proposal.service';
import { z } from 'zod';

const generateSchema = z.object({
  targetDate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { targetDate } = generateSchema.parse(body);

    const proposals = await routeProposalService.generateProposals(targetDate);

    return successResponse({
      success: true,
      proposalCount: proposals.length,
      proposals,
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
