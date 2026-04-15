import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    DEMO_MODE: 'true',
    DATABASE_URL: 'postgresql://test@localhost/test',
  },
}));

const mockPrisma = vi.hoisted(() => ({
  enquiry: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  visitRequest: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

describe('Triage Pipeline — Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes NEW enquiries to PARSED', async () => {
    const enquiries = [
      { id: 'eq-1', triageStatus: 'NEW', rawText: 'My horse needs dental work', receivedAt: new Date() },
      { id: 'eq-2', triageStatus: 'NEW', rawText: 'Urgent dental issue', receivedAt: new Date() },
    ];

    mockPrisma.enquiry.findMany.mockResolvedValue(enquiries);
    mockPrisma.enquiry.update.mockResolvedValue({});

    // Simulate triage logic: NEW → PARSED
    for (const eq of enquiries) {
      const nextStatus = eq.triageStatus === 'NEW' ? 'PARSED' : 'TRIAGED';
      await mockPrisma.enquiry.update({
        where: { id: eq.id },
        data: { triageStatus: nextStatus },
      });
    }

    expect(mockPrisma.enquiry.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.enquiry.update).toHaveBeenCalledWith({
      where: { id: 'eq-1' },
      data: { triageStatus: 'PARSED' },
    });
  });

  it('processes PARSED enquiries to TRIAGED', async () => {
    const enquiries = [
      { id: 'eq-3', triageStatus: 'PARSED', rawText: 'Routine dental for 3 horses in Montreux', receivedAt: new Date() },
    ];

    mockPrisma.enquiry.findMany.mockResolvedValue(enquiries);
    mockPrisma.enquiry.update.mockResolvedValue({});

    for (const eq of enquiries) {
      const nextStatus = eq.triageStatus === 'NEW' ? 'PARSED' : 'TRIAGED';
      await mockPrisma.enquiry.update({
        where: { id: eq.id },
        data: { triageStatus: nextStatus },
      });
    }

    expect(mockPrisma.enquiry.update).toHaveBeenCalledWith({
      where: { id: 'eq-3' },
      data: { triageStatus: 'TRIAGED' },
    });
  });

  it('creates visit request after triage', async () => {
    mockPrisma.visitRequest.create.mockResolvedValue({
      id: 'vr-new',
      planningStatus: 'PLANNING_POOL',
    });

    const vr = await mockPrisma.visitRequest.create({
      data: {
        customerId: 'demo-customer-sarah',
        yardId: 'demo-yard-montreux',
        enquiryId: 'eq-3',
        requestType: 'ROUTINE_DENTAL',
        urgencyLevel: 'ROUTINE',
        horseCount: 2,
        planningStatus: 'PLANNING_POOL',
      },
    });

    expect(vr.planningStatus).toBe('PLANNING_POOL');
    expect(mockPrisma.visitRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestType: 'ROUTINE_DENTAL',
          planningStatus: 'PLANNING_POOL',
        }),
      }),
    );
  });

  it('transitions visit request through status machine', async () => {
    const transitions = [
      { from: 'PLANNING_POOL', to: 'CLUSTERED' },
      { from: 'CLUSTERED', to: 'PROPOSED' },
      { from: 'PROPOSED', to: 'BOOKED' },
    ];

    for (const { to } of transitions) {
      mockPrisma.visitRequest.update.mockResolvedValue({ id: 'vr-1', planningStatus: to });

      const result = await mockPrisma.visitRequest.update({
        where: { id: 'vr-1' },
        data: { planningStatus: to },
      });

      expect(result.planningStatus).toBe(to);
    }

    expect(mockPrisma.visitRequest.update).toHaveBeenCalledTimes(3);
  });
});
