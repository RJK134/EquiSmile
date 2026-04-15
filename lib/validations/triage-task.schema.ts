import { z } from 'zod';

export const createTriageTaskSchema = z.object({
  visitRequestId: z.string().uuid('Invalid visit request ID'),
  taskType: z.enum([
    'URGENT_REVIEW', 'ASK_FOR_POSTCODE', 'ASK_HORSE_COUNT',
    'CLARIFY_SYMPTOMS', 'MANUAL_CLASSIFICATION',
  ]),
  assignedTo: z.string().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).default('OPEN'),
  notes: z.string().optional().nullable(),
});

export const updateTriageTaskSchema = z.object({
  taskType: z.enum([
    'URGENT_REVIEW', 'ASK_FOR_POSTCODE', 'ASK_HORSE_COUNT',
    'CLARIFY_SYMPTOMS', 'MANUAL_CLASSIFICATION',
  ]).optional(),
  assignedTo: z.string().optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).optional(),
  notes: z.string().optional().nullable(),
});

export const triageTaskQuerySchema = z.object({
  visitRequestId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).optional(),
  taskType: z.enum([
    'URGENT_REVIEW', 'ASK_FOR_POSTCODE', 'ASK_HORSE_COUNT',
    'CLARIFY_SYMPTOMS', 'MANUAL_CLASSIFICATION',
  ]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTriageTaskInput = z.infer<typeof createTriageTaskSchema>;
export type UpdateTriageTaskInput = z.infer<typeof updateTriageTaskSchema>;
export type TriageTaskQuery = z.infer<typeof triageTaskQuerySchema>;
