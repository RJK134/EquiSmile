import { z } from 'zod';

export const createEnquirySchema = z.object({
  channel: z.enum(['WHATSAPP', 'EMAIL']),
  customerId: z.string().uuid('Invalid customer ID').optional().nullable(),
  yardId: z.string().uuid('Invalid yard ID').optional().nullable(),
  sourceFrom: z.string().min(1, 'Source is required'),
  subject: z.string().optional().nullable(),
  rawText: z.string().min(1, 'Message text is required'),
  receivedAt: z.coerce.date().default(() => new Date()),
  triageStatus: z.enum(['NEW', 'PARSED', 'NEEDS_INFO', 'TRIAGED']).default('NEW'),
});

export const updateEnquirySchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  yardId: z.string().uuid().optional().nullable(),
  subject: z.string().optional().nullable(),
  triageStatus: z.enum(['NEW', 'PARSED', 'NEEDS_INFO', 'TRIAGED']).optional(),
});

export const enquiryQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  triageStatus: z.enum(['NEW', 'PARSED', 'NEEDS_INFO', 'TRIAGED']).optional(),
  channel: z.enum(['WHATSAPP', 'EMAIL']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
export type UpdateEnquiryInput = z.infer<typeof updateEnquirySchema>;
export type EnquiryQuery = z.infer<typeof enquiryQuerySchema>;
