import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { ApiError } from '@/lib/http-errors';
import { logger } from '@/lib/utils/logger';

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return errorResponse(error.expose ? error.message : 'Request failed', error.status);
  }

  if (error instanceof ZodError) {
    return errorResponse(error.message, 400);
  }

  if (error instanceof Error) {
    logger.error('API request failed', error);
    if (error.message.includes('not found') || error.message.includes('No ')) {
      return errorResponse(error.message, 404);
    }
    if (error.message.includes('Unique constraint')) {
      return errorResponse('A record with this value already exists', 409);
    }
    return errorResponse('Internal server error', 500);
  }

  return errorResponse('Internal server error', 500);
}

export function parseSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}
