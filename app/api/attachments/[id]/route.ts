import { NextRequest } from 'next/server';
import { attachmentService } from '@/lib/services/attachment.service';
import { errorResponse, handleApiError, successResponse } from '@/lib/api-utils';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const attachment = await attachmentService.findById(id);
    if (!attachment) return errorResponse('Attachment not found', 404);

    const bytes = await attachmentService.loadBytes(attachment);
    const body = new Uint8Array(bytes);
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
  try {
    const { id } = await context.params;
    await attachmentService.delete(id);
    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
