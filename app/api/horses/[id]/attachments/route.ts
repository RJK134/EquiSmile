import { NextRequest } from 'next/server';
import { attachmentService, ATTACHMENT_LIMITS } from '@/lib/services/attachment.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { requireRole, authzErrorResponse, AuthzError, ROLES } from '@/lib/auth/rbac';
import { staffRepository } from '@/lib/repositories/staff.repository';

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

    // Uploader attribution MUST come from the authenticated session only.
    // We deliberately do NOT read `uploadedById` (or any identity-like field)
    // from the multipart form — an authenticated vet could otherwise spoof
    // the uploader and blame a colleague.
    //
    // `subject.id` is the Auth.js `User.id`. The attachment FK points at
    // `Staff.id`, so we resolve via the optional 1:1 link `Staff.userId`.
    // If this operator hasn't been linked to a Staff row yet, attribution
    // falls back to `null` (best-effort: the session still provides audit
    // via `SecurityAuditLog` at higher layers).
    const staff = await staffRepository.findByUserId(subject.id);
    const uploadedById = staff?.id ?? null;

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
