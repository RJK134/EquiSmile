/**
 * Next.js `instrumentation.ts` — runs once per server startup, before
 * any request is served. Use this to wire cross-cutting hooks such as
 * the error-tracking sink.
 *
 * See https://nextjs.org/docs/app/guides/instrumentation.
 */

export async function register(): Promise<void> {
  // Only run in the Node runtime. Edge/middleware workers skip this.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const webhookUrl = process.env.EQUISMILE_ERROR_WEBHOOK_URL;
  if (!webhookUrl) return;

  // Use require-style dynamic import to avoid evaluating the logger /
  // sink module on Edge-runtime builds.
  const { registerErrorSink, logger } = await import('@/lib/utils/logger');
  const { createWebhookErrorSink } = await import(
    '@/lib/observability/webhook-error-sink'
  );

  registerErrorSink(
    createWebhookErrorSink({
      url: webhookUrl,
      token: process.env.EQUISMILE_ERROR_WEBHOOK_TOKEN,
      environment:
        process.env.EQUISMILE_ENV ??
        process.env.NODE_ENV ??
        'unknown',
    }),
  );

  logger.info('[observability] webhook error sink registered', {
    service: 'observability',
  });
}
