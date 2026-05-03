/**
 * POST /api/triage-ops/stock-reply
 *
 * Sends a vet-confirmed canned reply to the customer attached to a
 * visit request. Backs the "Reply with template" action on the triage
 * queue (G-2b from the May 2026 client user-story triage).
 *
 * Body:
 *   {
 *     visitRequestId: string,
 *     template: 'faq_acknowledge_v1' | 'faq_request_info_v1' |
 *               'faq_routine_booking_v1' | 'faq_emergency_redirect_v1'
 *   }
 *
 * Hard rule from the client user story: "Automated responses must remain
 * editable and reviewable. Veterinarian can override or adjust responses
 * before sending if needed." — the route is invoked by an explicit
 * vet-confirm action in the triage UI (not automatic), and templates
 * must come from the registry (not free text). Free-text responses
 * happen via the existing message-sending paths.
 *
 * Auth: NURSE+ (sending operator-confirmed messages is part of the
 * nurse's day-to-day; full clinical override remains VET+).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  STOCK_REPLY_TEMPLATES,
  type StockReplyTemplateName,
} from '@/lib/demo/template-registry';
import { stockReplyService } from '@/lib/services/stock-reply.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { AuthzError, ROLES, authzErrorResponse, requireRole } from '@/lib/auth/rbac';

const stockReplySchema = z.object({
  visitRequestId: z.string().min(1),
  template: z.enum(STOCK_REPLY_TEMPLATES as unknown as [string, ...string[]]),
});

export async function POST(request: NextRequest) {
  try {
    const subject = await requireRole(ROLES.NURSE);
    const body = await request.json();
    const parsed = stockReplySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.message, 400);
    }

    const result = await stockReplyService.sendStockReply({
      visitRequestId: parsed.data.visitRequestId,
      template: parsed.data.template as StockReplyTemplateName,
      actor: subject,
    });

    if (!result.sent) {
      return errorResponse(result.error ?? 'Send failed', 500);
    }
    return successResponse(result);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
