/**
 * Phase 6 — Appointment Validation Schemas
 */

import { z } from 'zod';

export const appointmentQuerySchema = z.object({
  status: z.enum(['PROPOSED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  routeRunId: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type AppointmentQueryInput = z.infer<typeof appointmentQuerySchema>;

export const cancelAppointmentSchema = z.object({
  reason: z.string().optional(),
});

export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const completeAppointmentSchema = z.object({
  notes: z.string().optional(),
  followUpRequired: z.boolean().optional().default(false),
  followUpDueDate: z.string().optional(),
  nextDentalDueDate: z.string().optional(),
});

export type CompleteAppointmentSchemaInput = z.infer<typeof completeAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  notes: z.string().optional(),
});

export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
