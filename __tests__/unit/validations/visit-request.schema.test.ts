import { describe, it, expect } from 'vitest';
import { createVisitRequestSchema, updateVisitRequestSchema } from '@/lib/validations/visit-request.schema';

describe('createVisitRequestSchema', () => {
  it('accepts valid visit request', () => {
    const result = createVisitRequestSchema.parse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      requestType: 'ROUTINE_DENTAL',
      urgencyLevel: 'ROUTINE',
    });
    expect(result.requestType).toBe('ROUTINE_DENTAL');
    expect(result.planningStatus).toBe('UNTRIAGED');
    expect(result.preferredDays).toEqual([]);
    expect(result.clinicalFlags).toEqual([]);
  });

  it('requires customerId', () => {
    expect(() => createVisitRequestSchema.parse({
      requestType: 'ROUTINE_DENTAL',
    })).toThrow();
  });

  it('requires valid requestType', () => {
    expect(() => createVisitRequestSchema.parse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      requestType: 'INVALID_TYPE',
    })).toThrow();
  });

  it('accepts full visit request with all fields', () => {
    const result = createVisitRequestSchema.parse({
      customerId: '550e8400-e29b-41d4-a716-446655440000',
      yardId: '550e8400-e29b-41d4-a716-446655440001',
      requestType: 'URGENT_ISSUE',
      urgencyLevel: 'URGENT',
      clinicalFlags: ['swelling', 'not_eating'],
      horseCount: 3,
      preferredDays: ['Mon', 'Tue'],
      preferredTimeBand: 'AM',
      needsMoreInfo: false,
    });
    expect(result.urgencyLevel).toBe('URGENT');
    expect(result.clinicalFlags).toEqual(['swelling', 'not_eating']);
    expect(result.horseCount).toBe(3);
  });
});

describe('updateVisitRequestSchema', () => {
  it('accepts urgency level update', () => {
    const result = updateVisitRequestSchema.parse({ urgencyLevel: 'URGENT' });
    expect(result.urgencyLevel).toBe('URGENT');
  });

  it('accepts planning status transition', () => {
    const result = updateVisitRequestSchema.parse({ planningStatus: 'PLANNING_POOL' });
    expect(result.planningStatus).toBe('PLANNING_POOL');
  });

  it('rejects invalid planning status', () => {
    expect(() => updateVisitRequestSchema.parse({ planningStatus: 'INVALID' })).toThrow();
  });
});
