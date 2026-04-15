import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPlanningService = {
  getDashboardStats: vi.fn(),
};

const mockEnquiryService = {
  getStats: vi.fn(),
};

const mockVisitRequestRepo = {
  findMany: vi.fn(),
};

const mockTriageTaskRepo = {
  findOpenTasks: vi.fn(),
};

vi.mock('@/lib/services/planning.service', () => ({
  planningService: mockPlanningService,
}));

vi.mock('@/lib/services/enquiry.service', () => ({
  enquiryService: mockEnquiryService,
}));

vi.mock('@/lib/repositories/visit-request.repository', () => ({
  visitRequestRepository: mockVisitRequestRepo,
}));

vi.mock('@/lib/repositories/triage-task.repository', () => ({
  triageTaskRepository: mockTriageTaskRepo,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregated dashboard data', async () => {
    mockPlanningService.getDashboardStats.mockResolvedValue({
      urgentCount: 2,
      needsInfoCount: 3,
      planningPoolCount: 5,
      activeCustomers: 10,
    });
    mockEnquiryService.getStats.mockResolvedValue({
      statusCounts: { NEW: 3, TRIAGED: 2 },
      recentEnquiries: [{ id: 'e1' }],
    });
    mockVisitRequestRepo.findMany.mockResolvedValue({
      data: [{ id: 'vr1', urgencyLevel: 'URGENT', yard: null, horseCount: null }],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });
    mockTriageTaskRepo.findOpenTasks.mockResolvedValue([{ id: 't1' }]);

    const { GET } = await import('@/app/api/dashboard/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats.urgentCount).toBe(2);
    expect(body.recentEnquiries).toHaveLength(1);
    expect(body.urgentRequests).toBeDefined();
    expect(body.openTriageTasks).toHaveLength(1);
  });
});
