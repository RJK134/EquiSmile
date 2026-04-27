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
  // Soft-delete: list endpoints hide tombstoned rows by default. Admin
  // ops surfaces (audit trail, restore UI) can pass `?includeDeleted=true`.
  //
  // NB: `z.coerce.boolean()` is unsafe here — it delegates to the JS
  // Boolean() constructor, which returns true for any non-empty string
  // INCLUDING "false". That would silently expose tombstoned enquiries
  // (containing inbound customer PII) to a caller who asked for the
  // exact opposite. Parse the string literally instead, matching the
  // pattern in customer.schema.ts / yard.schema.ts / horse.schema.ts.
  includeDeleted: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
export type UpdateEnquiryInput = z.infer<typeof updateEnquirySchema>;
export type EnquiryQuery = z.infer<typeof enquiryQuerySchema>;
