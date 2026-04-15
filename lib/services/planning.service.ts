import { visitRequestRepository } from '@/lib/repositories/visit-request.repository';
import { customerRepository } from '@/lib/repositories/customer.repository';

export interface PlanningPoolGroup {
  areaLabel: string;
  postcode: string;
  items: Awaited<ReturnType<typeof visitRequestRepository.findForPlanningPool>>;
}

export const planningService = {
  async getPlanningPool() {
    const items = await visitRequestRepository.findForPlanningPool();

    // Group by area label / postcode prefix
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.yard?.areaLabel || item.yard?.postcode?.slice(0, 3) || 'Unassigned';
      const existing = groups.get(key) || [];
      existing.push(item);
      groups.set(key, existing);
    }

    return Array.from(groups.entries()).map(([key, groupItems]) => ({
      areaLabel: key,
      postcode: groupItems[0]?.yard?.postcode || '',
      items: groupItems,
    }));
  },

  async getDashboardStats() {
    const [urgentCount, needsInfoCount, planningPoolCount, activeCustomers] = await Promise.all([
      visitRequestRepository.countUrgent(),
      visitRequestRepository.countNeedsInfo(),
      visitRequestRepository.countInPlanningPool(),
      customerRepository.count(),
    ]);

    return {
      urgentCount,
      needsInfoCount,
      planningPoolCount,
      activeCustomers,
    };
  },
};
