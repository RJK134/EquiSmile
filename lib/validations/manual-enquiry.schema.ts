import { z } from 'zod';

export const manualEnquirySchema = z.object({
  // Customer
  customerId: z.string().uuid('Invalid customer ID').optional().nullable(),
  newCustomerName: z.string().optional(),
  newCustomerPhone: z.string().optional(),
  newCustomerEmail: z.string().email('Invalid email').optional(),

  // Enquiry
  channel: z.enum(['WHATSAPP', 'EMAIL']),
  subject: z.string().optional(),
  rawText: z.string().min(1, 'Message text is required'),

  // Yard
  yardId: z.string().uuid('Invalid yard ID').optional().nullable(),

  // Visit request
  horseCount: z.number().int().min(1).optional().nullable(),
  requestType: z.enum(['ROUTINE_DENTAL', 'FOLLOW_UP', 'URGENT_ISSUE', 'FIRST_VISIT', 'ADMIN']),
  urgencyLevel: z.enum(['URGENT', 'SOON', 'ROUTINE']).default('ROUTINE'),
  preferredDays: z.array(z.string()).default([]),
  preferredTimeBand: z.enum(['AM', 'PM', 'ANY']).default('ANY'),
  notes: z.string().optional(),
});

export type ManualEnquiryInput = z.infer<typeof manualEnquirySchema>;
