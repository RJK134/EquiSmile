import { NextRequest } from 'next/server';
import { attachmentService, ATTACHMENT_LIMITS } from '@/lib/services/attachment.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const rows = await attachmentService.listForHorse(id);
    return successResponse(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
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
    const uploadedById = form.get('uploadedById');

    const attachment = await attachmentService.upload({
      horseId: id,
      filename: file.name,
      mimeType: file.type,
      bytes,
      description: typeof description === 'string' ? description : null,
      uploadedById: typeof uploadedById === 'string' && uploadedById.length > 0 ? uploadedById : null,
    });

    return successResponse(attachment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
