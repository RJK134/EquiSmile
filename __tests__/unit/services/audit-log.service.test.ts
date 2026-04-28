import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma, loggerWarn } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
  loggerWarn: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    warn: loggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { auditLogService } from '@/lib/services/audit-log.service';

describe('auditLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records action / entityType / entityId / userId / details', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' });

    await auditLogService.record({
      action: 'ENQUIRY_DELETED',
      entityType: 'Enquiry',
      entityId: 'enq-1',
      actor: {
        id: 'u-1',
        email: 'vet@example.com',
        githubLogin: 'vet',
        role: 'admin',
        actorLabel: 'vet',
      },
      details: { reason: 'spam' },
    });

    const call = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(call.data.action).toBe('ENQUIRY_DELETED');
    expect(call.data.entityType).toBe('Enquiry');
    expect(call.data.entityId).toBe('enq-1');
    expect(call.data.userId).toBe('u-1');
    expect(call.data.details).toEqual({ reason: 'spam' });
  });

  it('records null userId for system/automation actors', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' });

    await auditLogService.record({
      action: 'CRON_TICK',
      entityType: 'RouteRun',
      entityId: 'run-1',
      actor: null,
    });

    const call = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(call.data.userId).toBeNull();
  });

  it('swallows DB failures and logs a warning — never throws to caller', async () => {
    mockPrisma.auditLog.create.mockRejectedValue(new Error('connection lost'));

    await expect(
      auditLogService.record({
        action: 'X',
        entityType: 'Y',
        entityId: 'z',
        actor: null,
      }),
    ).resolves.toBeUndefined();

    expect(loggerWarn).toHaveBeenCalledOnce();
    expect(loggerWarn.mock.calls[0][0]).toBe('Audit log write failed');
  });

  it('listForEntity caps the requested limit', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    await auditLogService.listForEntity('Enquiry', 'e1', 5000);
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.take).toBe(500);
  });

  it('recent returns most-recent rows ordered desc', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'r1' }]);
    await auditLogService.recent(10);
    const call = mockPrisma.auditLog.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ createdAt: 'desc' });
    expect(call.take).toBe(10);
  });

  it('redacts PII from details before persisting (defence-in-depth)', async () => {
    // A future caller passes the customer object directly. The
    // service must scrub fullName / mobilePhone / email before the
    // payload reaches `prisma.auditLog.create`.
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' });

    await auditLogService.record({
      action: 'CUSTOMER_DELETED',
      entityType: 'Customer',
      entityId: 'cust-1',
      actor: null,
      details: {
        reason: 'duplicate',
        before: {
          fullName: 'Sarah Jones',
          mobilePhone: '+447911123456',
          email: 'sarah@example.com',
        },
      },
    });

    const call = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(call.data.details).toEqual({
      reason: 'duplicate',
      before: {
        fullName: '[pii-redacted]',
        mobilePhone: '[pii-redacted]',
        email: '[pii-redacted]',
      },
    });
  });

  it('preserves a safe operator-supplied details object verbatim', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' });

    await auditLogService.record({
      action: 'YARD_DELETED',
      entityType: 'Yard',
      entityId: 'y1',
      actor: null,
      details: { reason: 'soft-delete' },
    });

    const call = mockPrisma.auditLog.create.mock.calls[0][0];
    expect(call.data.details).toEqual({ reason: 'soft-delete' });
  });
});
