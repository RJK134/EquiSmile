/**
 * GET /api/reminders/check — Check and send due reminders
 *
 * Called by n8n on a schedule (every 30 min).
 */

import { reminderService } from '@/lib/services/reminder.service';
import { successResponse, handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results = await reminderService.checkAndSendReminders();

    const sent = results.filter((r) => r.sent).length;
    const failed = results.filter((r) => !r.sent).length;

    return successResponse({
      success: true,
      message: `Processed ${results.length} reminders: ${sent} sent, ${failed} failed`,
      data: results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
