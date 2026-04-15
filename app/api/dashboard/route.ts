import { prisma } from '@/lib/prisma';
import { planningService } from '@/lib/services/planning.service';
import { enquiryService } from '@/lib/services/enquiry.service';
import { triageTaskRepository } from '@/lib/repositories/triage-task.repository';
import { visitRequestRepository } from '@/lib/repositories/visit-request.repository';
import { successResponse, handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [
      stats,
      enquiryStats,
      urgentRequests,
      needsInfoRequests,
      openTriageTasks,
      // SLA metrics
      urgentOverdueCount,
      missingInfoAgingCount,
      triagedTodayCount,
      triagedWeekCount,
      totalTriagedCount,
      autoTriagedCount,
      openTaskCount,
    ] = await Promise.all([
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
      // Urgent items not reviewed within 15 minutes
      prisma.visitRequest.count({
        where: {
          urgencyLevel: 'URGENT',
          planningStatus: { in: ['UNTRIAGED', 'READY_FOR_REVIEW'] },
          createdAt: { lt: fifteenMinutesAgo },
        },
      }),
      // Missing info items waiting >48h
      prisma.visitRequest.count({
        where: {
          needsMoreInfo: true,
          planningStatus: { notIn: ['COMPLETED', 'CANCELLED'] },
          lastFollowUpAt: { lt: fortyEightHoursAgo },
        },
      }),
      // Triaged today
      prisma.enquiry.count({
        where: {
          triageStatus: 'TRIAGED',
          createdAt: { gte: todayStart },
        },
      }),
      // Triaged this week
      prisma.enquiry.count({
        where: {
          triageStatus: 'TRIAGED',
          createdAt: { gte: weekStart },
        },
      }),
      // Total triaged (for rate calculation)
      prisma.enquiry.count({
        where: {
          triageStatus: { in: ['TRIAGED', 'NEEDS_INFO'] },
        },
      }),
      // Auto-triaged (have confidence score)
      prisma.visitRequest.count({
        where: {
          autoTriageConfidence: { not: null },
        },
      }),
      // Open triage task count
      triageTaskRepository.countOpen(),
    ]);

    const needsInfoItems = needsInfoRequests.data.filter((vr) => vr.yard === null || vr.horseCount === null);

    const autoTriageRate = totalTriagedCount > 0
      ? Math.round((autoTriagedCount / totalTriagedCount) * 100)
      : 0;

    return successResponse({
      stats,
      recentEnquiries: enquiryStats.recentEnquiries,
      urgentRequests: urgentRequests.data,
      needsInfoItems,
      openTriageTasks,
      sla: {
        urgentOverdueCount,
        missingInfoAgingCount,
        triagedTodayCount,
        triagedWeekCount,
        autoTriageRate,
        openTaskCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
