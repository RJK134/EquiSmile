import { NextRequest } from 'next/server';
import { attachmentService, ATTACHMENT_LIMITS } from '@/lib/services/attachment.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(ROLES.NURSE);
    const { id } = await context.params;
    const rows = await attachmentService.listForHorse(id);
    return successResponse(rows);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const subject = await requireRole(ROLES.VET);
    const { id } = await context.params;

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('Content-Type must be multipart/form-data', 415);
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return errorResponse('Missing file field', 400);
    }
    if (file.size > ATTACHMENT_LIMITS.MAX_BYTES) {
      return errorResponse(`File exceeds ${ATTACHMENT_LIMITS.MAX_BYTES / (1024 * 1024)} MB limit`, 413);
    }
    if (!ATTACHMENT_LIMITS.ALLOWED_MIMES.has(file.type)) {
      return errorResponse(`Unsupported file type: ${file.type}`, 415);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const description = form.get('description');
    const formStaffId = form.get('uploadedById');
    // Trust the session for attribution; fall back to the form value only
    // when the subject did not propagate one (never trust unauth'd input
    // to set the uploader identity).
    const uploadedById =
      typeof formStaffId === 'string' && formStaffId.length > 0 ? formStaffId : subject.id;

    const attachment = await attachmentService.upload({
      horseId: id,
      filename: file.name,
      mimeType: file.type,
      bytes,
      description: typeof description === 'string' ? description : null,
      uploadedById,
    });

    return successResponse(attachment, 201);
  } catch (error) {
    if (error instanceof AuthzError) return authzErrorResponse(error);
    return handleApiError(error);
  }
}
