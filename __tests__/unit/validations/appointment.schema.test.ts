import { describe, it, expect } from 'vitest';
import {
  appointmentQuerySchema,
  cancelAppointmentSchema,
  completeAppointmentSchema,
  rescheduleAppointmentSchema,
} from '@/lib/validations/appointment.schema';

describe('appointmentQuerySchema', () => {
  it('parses valid query with defaults', () => {
    const result = appointmentQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('parses query with status filter', () => {
    const result = appointmentQuerySchema.parse({ status: 'PROPOSED' });
    expect(result.status).toBe('PROPOSED');
  });

  it('parses query with date range', () => {
    const result = appointmentQuerySchema.parse({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
    });
    expect(result.dateFrom).toBe('2026-05-01');
    expect(result.dateTo).toBe('2026-05-31');
  });

  it('rejects invalid status', () => {
    expect(() => appointmentQuerySchema.parse({ status: 'INVALID' })).toThrow();
  });

  it('coerces string page numbers', () => {
    const result = appointmentQuerySchema.parse({ page: '3', pageSize: '10' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
  });
});

describe('cancelAppointmentSchema', () => {
  it('parses empty body', () => {
    const result = cancelAppointmentSchema.parse({});
    expect(result.reason).toBeUndefined();
  });

  it('parses with reason', () => {
    const result = cancelAppointmentSchema.parse({ reason: 'Customer requested' });
    expect(result.reason).toBe('Customer requested');
  });
});

describe('completeAppointmentSchema', () => {
  it('parses empty body with defaults', () => {
    const result = completeAppointmentSchema.parse({});
    expect(result.followUpRequired).toBe(false);
  });

  it('parses full completion input', () => {
    const result = completeAppointmentSchema.parse({
      notes: 'All teeth healthy',
      followUpRequired: true,
      followUpDueDate: '2026-06-01',
      nextDentalDueDate: '2027-05-01',
    });
    expect(result.notes).toBe('All teeth healthy');
    expect(result.followUpRequired).toBe(true);
    expect(result.followUpDueDate).toBe('2026-06-01');
    expect(result.nextDentalDueDate).toBe('2027-05-01');
  });
});

describe('rescheduleAppointmentSchema', () => {
  it('parses empty body', () => {
    const result = rescheduleAppointmentSchema.parse({});
    expect(result.notes).toBeUndefined();
  });

  it('parses with notes', () => {
    const result = rescheduleAppointmentSchema.parse({ notes: 'Move to next week' });
    expect(result.notes).toBe('Move to next week');
  });
});
