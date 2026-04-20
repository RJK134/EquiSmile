import { NextRequest } from 'next/server';
import { z } from 'zod';
import { clinicalRecordService } from '@/lib/services/clinical-record.service';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

const createFindingSchema = z.object({
  kind: z.literal('finding'),
  toothId: z.string().optional().nullable(),
  category: z.enum(['HOOK', 'WAVE', 'RAMP', 'DIASTEMA', 'EOTRH', 'FRACTURE', 'CARIES', 'WEAR', 'MISSING', 'OTHER']).optional(),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE']).optional(),
  description: z.string().min(1),
  dentalChartId: z.string().optional().nullable(),
  attachmentId: z.string().optional().nullable(),
  createdById: z.string().optional().nullable(),
  findingDate: z.coerce.date().optional(),
});

const createDentalChartSchema = z.object({
  kind: z.literal('dentalChart'),
  appointmentId: z.string().optional().nullable(),
  recordedById: z.string().optional().nullable(),
  recordedAt: z.coerce.date().optional(),
  generalNotes: z.string().optional().nullable(),
  attachmentId: z.string().optional().nullable(),
});

const createPrescriptionSchema = z.object({
  kind: z.literal('prescription'),
  visitRequestId: z.string().optional().nullable(),
  appointmentId: z.string().optional().nullable(),
  prescribedById: z.string().optional().nullable(),
  prescribedAt: z.coerce.date().optional(),
  medicineName: z.string().min(1),
  dosage: z.string().min(1),
  durationDays: z.number().int().nonnegative().optional().nullable(),
  withdrawalPeriodDays: z.number().int().nonnegative().optional().nullable(),
  instructions: z.string().optional().nullable(),
});

/**
 * GET /api/horses/[id]/clinical
 * Returns { dentalCharts, findings, prescriptions }
 *
 * POST /api/horses/[id]/clinical
 * Body: one of { kind: "dentalChart" | "finding" | "prescription", ... }
 */

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const [dentalCharts, findings, prescriptions] = await Promise.all([
      clinicalRecordService.listDentalCharts(id),
      clinicalRecordService.listFindings(id),
      clinicalRecordService.listPrescriptions(id),
    ]);
    return successResponse({ dentalCharts, findings, prescriptions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    switch (body.kind) {
      case 'dentalChart': {
        const payload = createDentalChartSchema.parse(body);
        const chart = await clinicalRecordService.createDentalChart({ ...payload, horseId: id });
        return successResponse(chart, 201);
      }
      case 'finding': {
        const payload = createFindingSchema.parse(body);
        const finding = await clinicalRecordService.createFinding({ ...payload, horseId: id });
        return successResponse(finding, 201);
      }
      case 'prescription': {
        const payload = createPrescriptionSchema.parse(body);
        const rx = await clinicalRecordService.createPrescription({ ...payload, horseId: id });
        return successResponse(rx, 201);
      }
      default:
        return errorResponse("body.kind must be 'dentalChart', 'finding', or 'prescription'", 400);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
