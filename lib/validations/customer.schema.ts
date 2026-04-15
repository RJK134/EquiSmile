import { z } from 'zod';

export const createCustomerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
  mobilePhone: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable(),
  preferredChannel: z.enum(['WHATSAPP', 'EMAIL', 'PHONE']).default('WHATSAPP'),
  preferredLanguage: z.enum(['en', 'fr']).default('en'),
  notes: z.string().optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerQuerySchema = z.object({
  search: z.string().optional(),
  preferredChannel: z.enum(['WHATSAPP', 'EMAIL', 'PHONE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerQuery = z.infer<typeof customerQuerySchema>;
