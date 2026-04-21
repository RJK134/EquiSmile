import { prisma } from '@/lib/prisma';
import type { FailedOperationStatus } from '@prisma/client';
import { redact } from '@/lib/utils/log-redact';

/**
 * Phase 14 PR D — dead-letter queue (AMBER-15).
 *
 * When the retry wrapper permanently fails, callers enqueue the
 * operation here so it's visible to operators and can be replayed later
 * (outside the request path).
 *
 * The `payload` is JSON-stringified after running through `redact()`.
 * Never store secrets or raw request bodies that might carry PII
 * beyond what the operator actually needs to triage the failure.
 */

export interface EnqueueFailureInput {
  scope: string;
  payload: unknown;
  lastError: unknown;
  attempts?: number;
  operationKey?: string | null;
}

export const deadLetterService = {
  async enqueue(input: EnqueueFailureInput): Promise<void> {
    const payloadJson = JSON.stringify(redact(input.payload));
    const lastError =
      input.lastError instanceof Error
        ? input.lastError.message
        : String(input.lastError);
    try {
      await prisma.failedOperation.create({
        data: {
          scope: input.scope,
          operationKey: input.operationKey ?? null,
          payload: payloadJson.slice(0, 8_000),
          lastError: lastError.slice(0, 2_000),
          attempts: input.attempts ?? 0,
        },
      });
    } catch (error) {
      console.warn('[dead-letter] failed to enqueue', {
        scope: input.scope,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async list(options: { status?: FailedOperationStatus; scope?: string; limit?: number } = {}) {
    const take = Math.min(Math.max(options.limit ?? 50, 1), 500);
    return prisma.failedOperation.findMany({
      where: {
        ...(options.status ? { status: options.status } : {}),
        ...(options.scope ? { scope: options.scope } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },

  async markStatus(id: string, status: FailedOperationStatus) {
    return prisma.failedOperation.update({
      where: { id },
      data: { status },
    });
  },
};
