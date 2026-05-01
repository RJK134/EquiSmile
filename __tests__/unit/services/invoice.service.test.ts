import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { computeStatus } from '@/lib/services/invoice.service';

const D = (v: number | string) => new Prisma.Decimal(v);
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

describe('invoiceService.computeStatus', () => {
  it('returns OPEN when issued, no payments, before dueAt', () => {
    expect(
      computeStatus({
        current: 'OPEN',
        total: D(120),
        paidSum: D(0),
        dueAt: FUTURE,
      }),
    ).toBe('OPEN');
  });

  it('returns OVERDUE when issued, no payments, past dueAt', () => {
    expect(
      computeStatus({
        current: 'OPEN',
        total: D(120),
        paidSum: D(0),
        dueAt: PAST,
      }),
    ).toBe('OVERDUE');
  });

  it('returns PARTIAL when paidSum > 0 and < total, regardless of dueAt', () => {
    expect(
      computeStatus({
        current: 'OPEN',
        total: D(120),
        paidSum: D(50),
        dueAt: FUTURE,
      }),
    ).toBe('PARTIAL');
    expect(
      computeStatus({
        current: 'OVERDUE',
        total: D(120),
        paidSum: D(50),
        dueAt: PAST,
      }),
    ).toBe('PARTIAL');
  });

  it('returns PAID when paidSum equals total to the cent', () => {
    expect(
      computeStatus({
        current: 'PARTIAL',
        total: D('120.00'),
        paidSum: D('120.00'),
        dueAt: FUTURE,
      }),
    ).toBe('PAID');
  });

  it('returns PAID when paidSum exceeds total (overpayment)', () => {
    expect(
      computeStatus({
        current: 'OPEN',
        total: D(120),
        paidSum: D(125),
        dueAt: FUTURE,
      }),
    ).toBe('PAID');
  });

  it('preserves CANCELLED — never auto-recomputed', () => {
    expect(
      computeStatus({
        current: 'CANCELLED',
        total: D(120),
        paidSum: D(120),
        dueAt: FUTURE,
      }),
    ).toBe('CANCELLED');
    expect(
      computeStatus({
        current: 'CANCELLED',
        total: D(120),
        paidSum: D(0),
        dueAt: PAST,
      }),
    ).toBe('CANCELLED');
  });

  it('preserves DRAFT — never auto-recomputed', () => {
    expect(
      computeStatus({
        current: 'DRAFT',
        total: D(120),
        paidSum: D(0),
        dueAt: PAST,
      }),
    ).toBe('DRAFT');
  });

  it('honours an injected `now` for deterministic OVERDUE checks', () => {
    const dueAt = new Date('2026-04-01T00:00:00Z');
    const before = new Date('2026-03-31T00:00:00Z');
    const after = new Date('2026-04-02T00:00:00Z');

    expect(
      computeStatus({ current: 'OPEN', total: D(100), paidSum: D(0), dueAt, now: before }),
    ).toBe('OPEN');
    expect(
      computeStatus({ current: 'OPEN', total: D(100), paidSum: D(0), dueAt, now: after }),
    ).toBe('OVERDUE');
  });

  it('PAID stays PAID once a refund leaves the row over-paid then back to total', () => {
    // Edge case: the operator records a refund. recomputeStatus is
    // called before the refund hits — sum may still equal total.
    expect(
      computeStatus({
        current: 'PAID',
        total: D(120),
        paidSum: D(120),
        dueAt: PAST,
      }),
    ).toBe('PAID');
  });
});
