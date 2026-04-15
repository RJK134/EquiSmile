import { planningService } from '@/lib/services/planning.service';
import { enquiryService } from '@/lib/services/enquiry.service';
import { triageTaskRepository } from '@/lib/repositories/triage-task.repository';
import { visitRequestRepository } from '@/lib/repositories/visit-request.repository';
import { successResponse, handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [stats, enquiryStats, urgentRequests, needsInfoRequests, openTriageTasks] = await Promise.all([
      planningService.getDashboardStats(),
      enquiryService.getStats(),
      visitRequestRepository.findMany({
        urgencyLevel: 'URGENT',
        page: 1,
        pageSize: 10,
      }),
      visitRequestRepository.findMany({
        page: 1,
        pageSize: 10,
      }),
      triageTaskRepository.findOpenTasks(),
    ]);

    // Filter needs-info items client-side from the full list
    const needsInfoItems = needsInfoRequests.data.filter((vr) => vr.yard === null || vr.horseCount === null);

    return successResponse({
      stats,
      recentEnquiries: enquiryStats.recentEnquiries,
      urgentRequests: urgentRequests.data,
      needsInfoItems,
      openTriageTasks,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
