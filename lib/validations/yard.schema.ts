import { z } from 'zod';

export const createYardSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  yardName: z.string().min(1, 'Yard name is required').max(200),
  addressLine1: z.string().min(1, 'Address line 1 is required').max(300),
  addressLine2: z.string().optional().nullable(),
  town: z.string().min(1, 'Town is required').max(100),
  county: z.string().optional().nullable(),
  postcode: z.string().min(1, 'Postcode is required').max(20),
  accessNotes: z.string().optional().nullable(),
  areaLabel: z.string().optional().nullable(),
});

export const updateYardSchema = createYardSchema.partial();

export const yardQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  areaLabel: z.string().optional(),
  postcode: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateYardInput = z.infer<typeof createYardSchema>;
export type UpdateYardInput = z.infer<typeof updateYardSchema>;
export type YardQuery = z.infer<typeof yardQuerySchema>;
