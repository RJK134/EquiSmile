/**
 * GET /api/reminders/check — Check and send due reminders.
 *
 * Called by n8n on a schedule (every 30 min). Session-less — protected
 * by the same `N8N_API_KEY` Bearer-token check as the rest of the n8n
 * integration surface. Fails closed in production when the key is unset.
 */

import { NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { reminderService } from '@/lib/services/reminder.service';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { requireN8nApiKey } from '@/lib/utils/signature';
import { clientKeyFromRequest, rateLimitedResponse, rateLimiter } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';

// 12/min is ~1 every 5s — more than enough for any sane cron cadence.
const limiter = rateLimiter({ windowMs: 60_000, max: 12 });

export async function GET(request: NextRequest) {
  const rl = limiter.check(clientKeyFromRequest(request, 'reminders'));
  if (!rl.allowed) return rateLimitedResponse(rl);

  const gate = requireN8nApiKey({
    authHeader: request.headers.get('authorization'),
    expectedKey: env.N8N_API_KEY,
    demoMode: env.DEMO_MODE === 'true',
  });
  if (!gate.ok) return gate.response;

  // Each dispatch wraps its own try/catch so a single failure (e.g. n8n
  // mid-flight schema change, transient WhatsApp 5xx) doesn't abort the
  // remaining reminder paths. We still surface any error to the caller
  // via the `errors` array on the response so n8n can alert.
  const errors: Array<{ kind: string; message: string }> = [];

  let appointmentResults: Awaited<ReturnType<typeof reminderService.checkAndSendReminders>> = [];
  try {
    appointmentResults = await reminderService.checkAndSendReminders();
  } catch (error) {
    errors.push({ kind: 'appointment', message: error instanceof Error ? error.message : 'unknown' });
  }

  let dentalResults: Awaited<ReturnType<typeof reminderService.dispatchDentalDueReminders>> = [];
  try {
    dentalResults = await reminderService.dispatchDentalDueReminders();
  } catch (error) {
    errors.push({ kind: 'dental', message: error instanceof Error ? error.message : 'unknown' });
  }

  let vaccinationResults: Awaited<ReturnType<typeof reminderService.dispatchVaccinationDueReminders>> = [];
  try {
    vaccinationResults = await reminderService.dispatchVaccinationDueReminders();
  } catch (error) {
    errors.push({ kind: 'vaccination', message: error instanceof Error ? error.message : 'unknown' });
  }

  let invoiceResults: Awaited<ReturnType<typeof reminderService.dispatchOverdueInvoiceReminders>> = [];
  try {
    invoiceResults = await reminderService.dispatchOverdueInvoiceReminders();
  } catch (error) {
    errors.push({ kind: 'invoice-overdue', message: error instanceof Error ? error.message : 'unknown' });
  }

  const totalSent =
    appointmentResults.filter((r) => r.sent).length +
    dentalResults.filter((r) => r.sent).length +
    vaccinationResults.filter((r) => r.sent).length +
    invoiceResults.filter((r) => r.sent).length;
  const totalProcessed =
    appointmentResults.length + dentalResults.length + vaccinationResults.length + invoiceResults.length;

  try {
    return successResponse({
      success: errors.length === 0,
      message: `Processed ${totalProcessed} reminders: ${totalSent} sent, ${totalProcessed - totalSent} failed`,
      data: {
        appointment: appointmentResults,
        dental: dentalResults,
        vaccination: vaccinationResults,
        invoiceOverdue: invoiceResults,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
