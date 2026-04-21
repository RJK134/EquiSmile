import { NextRequest } from 'next/server';
import { attachmentService } from '@/lib/services/attachment.service';
import { errorResponse, handleApiError, successResponse } from '@/lib/api-utils';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';
import { securityAuditService } from '@/lib/services/security-audit.service';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let subject: Awaited<ReturnType<typeof requireRole>>;
  try {
    subject = await requireRole(ROLES.NURSE);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }

  try {
    const { id } = await context.params;
    const attachment = await attachmentService.findById(id);
    if (!attachment) return errorResponse('Attachment not found', 404);

    const bytes = await attachmentService.loadBytes(attachment);
    const body = new Uint8Array(bytes);

    await securityAuditService.record({
      event: 'ATTACHMENT_DOWNLOADED',
      actor: subject,
      targetType: 'HorseAttachment',
      targetId: id,
      detail: `mime=${attachment.mimeType}; bytes=${attachment.sizeBytes}`,
    });

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.filename)}"`,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let subject: Awaited<ReturnType<typeof requireRole>>;
  try {
    subject = await requireRole(ROLES.VET);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }

  try {
    const { id } = await context.params;
    await attachmentService.delete(id);
    await securityAuditService.record({
      event: 'ATTACHMENT_DELETED',
      actor: subject,
      targetType: 'HorseAttachment',
      targetId: id,
    });
    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
