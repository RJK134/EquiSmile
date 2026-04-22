import { z } from 'zod';

export const createHorseSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  primaryYardId: z.string().uuid('Invalid yard ID').optional().nullable(),
  horseName: z.string().min(1, 'Horse name is required').max(200),
  age: z.number().int().min(0).max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
  dentalDueDate: z.coerce.date().optional().nullable(),
  active: z.boolean().default(true),
});

export const updateHorseSchema = createHorseSchema.partial();

export const horseQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  primaryYardId: z.string().uuid().optional(),
  active: z.enum(['true', 'false']).optional().transform((v) => v === undefined ? undefined : v === 'true'),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

export type CreateHorseInput = z.infer<typeof createHorseSchema>;
export type UpdateHorseInput = z.infer<typeof updateHorseSchema>;
export type HorseQuery = z.infer<typeof horseQuerySchema>;
