import type { NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { ApiError } from '@/lib/http-errors';
import { verifyN8nApiKey } from '@/lib/utils/signature';

export function assertN8nRequest(request: NextRequest): void {
  const authHeader = request.headers.get('authorization');

  if (!env.N8N_API_KEY) {
    throw new ApiError(503, 'Webhook service is not configured');
  }

  if (!verifyN8nApiKey(authHeader, env.N8N_API_KEY)) {
    throw new ApiError(401, 'Unauthorized');
  }
}
