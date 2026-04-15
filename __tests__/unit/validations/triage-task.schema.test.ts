import { describe, it, expect } from 'vitest';
import { createTriageTaskSchema, updateTriageTaskSchema } from '@/lib/validations/triage-task.schema';

describe('createTriageTaskSchema', () => {
  it('accepts valid triage task', () => {
    const result = createTriageTaskSchema.parse({
      visitRequestId: '550e8400-e29b-41d4-a716-446655440000',
      taskType: 'URGENT_REVIEW',
    });
    expect(result.taskType).toBe('URGENT_REVIEW');
    expect(result.status).toBe('OPEN');
  });

  it('requires visitRequestId', () => {
    expect(() => createTriageTaskSchema.parse({
      taskType: 'URGENT_REVIEW',
    })).toThrow();
  });

  it('requires valid taskType', () => {
    expect(() => createTriageTaskSchema.parse({
      visitRequestId: '550e8400-e29b-41d4-a716-446655440000',
      taskType: 'INVALID_TYPE',
    })).toThrow();
  });

  it('accepts all valid task types', () => {
    const types = ['URGENT_REVIEW', 'ASK_FOR_POSTCODE', 'ASK_HORSE_COUNT', 'CLARIFY_SYMPTOMS', 'MANUAL_CLASSIFICATION'];
    for (const taskType of types) {
      const result = createTriageTaskSchema.parse({
        visitRequestId: '550e8400-e29b-41d4-a716-446655440000',
        taskType,
      });
      expect(result.taskType).toBe(taskType);
    }
  });
});

describe('updateTriageTaskSchema', () => {
  it('accepts status update', () => {
    const result = updateTriageTaskSchema.parse({ status: 'DONE' });
    expect(result.status).toBe('DONE');
  });

  it('accepts notes update', () => {
    const result = updateTriageTaskSchema.parse({ notes: 'Contacted customer for postcode' });
    expect(result.notes).toBe('Contacted customer for postcode');
  });

  it('rejects invalid status', () => {
    expect(() => updateTriageTaskSchema.parse({ status: 'INVALID' })).toThrow();
  });
});
