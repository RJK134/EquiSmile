import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireRoleMock = vi.hoisted(() => vi.fn());

// next-auth's bootstrap reaches into `next/server` via a path the vitest
// SSR resolver can't walk; stub the module graph.
vi.mock('@/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/auth/rbac', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/rbac')>('@/lib/auth/rbac');
  return { ...actual, requireRole: requireRoleMock };
});

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
  countOpen: vi.fn(),
};

const mockAppointmentRepo = {
  findToday: vi.fn(),
  findUpcoming: vi.fn(),
  countPendingConfirmations: vi.fn(),
  countCompletedThisWeek: vi.fn(),
  countFollowUpsDue: vi.fn(),
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

vi.mock('@/lib/repositories/appointment.repository', () => ({
  appointmentRepository: mockAppointmentRepo,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    visitRequest: {
      count: vi.fn().mockResolvedValue(0),
    },
    enquiry: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue({
      id: 'u1', email: 'a@b.c', githubLogin: null, role: 'readonly', actorLabel: 'a@b.c',
    });
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
    mockTriageTaskRepo.countOpen.mockResolvedValue(1);
    mockAppointmentRepo.findToday.mockResolvedValue([]);
    mockAppointmentRepo.findUpcoming.mockResolvedValue([]);
    mockAppointmentRepo.countPendingConfirmations.mockResolvedValue(0);
    mockAppointmentRepo.countCompletedThisWeek.mockResolvedValue(0);
    mockAppointmentRepo.countFollowUpsDue.mockResolvedValue(0);

    const { GET } = await import('@/app/api/dashboard/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats.urgentCount).toBe(2);
    expect(body.recentEnquiries).toHaveLength(1);
    expect(body.urgentRequests).toBeDefined();
    expect(body.openTriageTasks).toHaveLength(1);
    expect(body.sla).toBeDefined();
    expect(body.sla.openTaskCount).toBe(1);
  });
});
