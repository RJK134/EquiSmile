import { z } from 'zod';

export const createVisitRequestSchema = z.object({
  enquiryId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid('Invalid customer ID'),
  yardId: z.string().uuid('Invalid yard ID').optional().nullable(),
  requestType: z.enum(['ROUTINE_DENTAL', 'FOLLOW_UP', 'URGENT_ISSUE', 'FIRST_VISIT', 'ADMIN']),
  urgencyLevel: z.enum(['URGENT', 'SOON', 'ROUTINE']).default('ROUTINE'),
  clinicalFlags: z.array(z.string()).default([]),
  horseCount: z.number().int().min(1).optional().nullable(),
  specificHorses: z.array(z.string()).default([]),
  preferredDays: z.array(z.string()).default([]),
  preferredTimeBand: z.enum(['AM', 'PM', 'ANY']).default('ANY'),
  needsMoreInfo: z.boolean().default(false),
  planningStatus: z.enum([
    'UNTRIAGED', 'READY_FOR_REVIEW', 'PLANNING_POOL',
    'CLUSTERED', 'PROPOSED', 'BOOKED', 'COMPLETED', 'CANCELLED',
  ]).default('UNTRIAGED'),
});

export const updateVisitRequestSchema = z.object({
  requestType: z.enum(['ROUTINE_DENTAL', 'FOLLOW_UP', 'URGENT_ISSUE', 'FIRST_VISIT', 'ADMIN']).optional(),
  urgencyLevel: z.enum(['URGENT', 'SOON', 'ROUTINE']).optional(),
  clinicalFlags: z.array(z.string()).optional(),
  horseCount: z.number().int().min(1).optional().nullable(),
  preferredDays: z.array(z.string()).optional(),
  preferredTimeBand: z.enum(['AM', 'PM', 'ANY']).optional(),
  needsMoreInfo: z.boolean().optional(),
  planningStatus: z.enum([
    'UNTRIAGED', 'READY_FOR_REVIEW', 'PLANNING_POOL',
    'CLUSTERED', 'PROPOSED', 'BOOKED', 'COMPLETED', 'CANCELLED',
  ]).optional(),
});

export const visitRequestQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  planningStatus: z.enum([
    'UNTRIAGED', 'READY_FOR_REVIEW', 'PLANNING_POOL',
    'CLUSTERED', 'PROPOSED', 'BOOKED', 'COMPLETED', 'CANCELLED',
  ]).optional(),
  urgencyLevel: z.enum(['URGENT', 'SOON', 'ROUTINE']).optional(),
  requestType: z.enum(['ROUTINE_DENTAL', 'FOLLOW_UP', 'URGENT_ISSUE', 'FIRST_VISIT', 'ADMIN']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateVisitRequestInput = z.infer<typeof createVisitRequestSchema>;
export type UpdateVisitRequestInput = z.infer<typeof updateVisitRequestSchema>;
export type VisitRequestQuery = z.infer<typeof visitRequestQuerySchema>;
