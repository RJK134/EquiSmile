import { z } from 'zod';

const roleEnum = z.enum(['VET', 'ADMIN', 'NURSE']);

export const createStaffSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  role: roleEnum.optional(),
  colour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'colour must be a 6-digit hex (e.g. #9b214d)')
    .optional()
    .nullable(),
  notes: z.string().max(2000).optional().nullable(),
  userId: z.string().optional().nullable(),
});

export const updateStaffSchema = createStaffSchema.partial().extend({
  active: z.boolean().optional(),
});

export const assignAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  staffId: z.string().min(1),
  primary: z.boolean().optional(),
});

export const assignRouteRunSchema = z.object({
  routeRunId: z.string().min(1),
  staffId: z.string().min(1),
  isLead: z.boolean().optional(),
});

export type CreateStaffPayload = z.infer<typeof createStaffSchema>;
export type UpdateStaffPayload = z.infer<typeof updateStaffSchema>;
