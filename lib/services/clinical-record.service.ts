import { prisma } from '@/lib/prisma';
import type {
  ClinicalFinding,
  DentalChart,
  FindingCategory,
  FindingSeverity,
  Prescription,
  PrescriptionStatus,
} from '@prisma/client';

export interface CreateDentalChartInput {
  horseId: string;
  appointmentId?: string | null;
  recordedById?: string | null;
  recordedAt?: Date;
  generalNotes?: string | null;
  attachmentId?: string | null;
}

export interface CreateFindingInput {
  horseId: string;
  dentalChartId?: string | null;
  findingDate?: Date;
  toothId?: string | null;
  category?: FindingCategory;
  severity?: FindingSeverity;
  description: string;
  attachmentId?: string | null;
  createdById?: string | null;
}

export interface CreatePrescriptionInput {
  horseId: string;
  visitRequestId?: string | null;
  appointmentId?: string | null;
  prescribedById?: string | null;
  prescribedAt?: Date;
  medicineName: string;
  dosage: string;
  durationDays?: number | null;
  withdrawalPeriodDays?: number | null;
  instructions?: string | null;
}

export const clinicalRecordService = {
  // ─── Dental charts ─────────────────────────────────────────────────────
  async createDentalChart(input: CreateDentalChartInput): Promise<DentalChart> {
    return prisma.dentalChart.create({
      data: {
        horseId: input.horseId,
        appointmentId: input.appointmentId ?? null,
        recordedById: input.recordedById ?? null,
        recordedAt: input.recordedAt ?? new Date(),
        generalNotes: input.generalNotes ?? null,
        attachmentId: input.attachmentId ?? null,
      },
    });
  },

  async listDentalCharts(horseId: string) {
    return prisma.dentalChart.findMany({
      where: { horseId },
      orderBy: { recordedAt: 'desc' },
      include: {
        findings: true,
        attachment: true,
        recordedBy: { select: { id: true, name: true } },
      },
    });
  },

  // ─── Clinical findings ─────────────────────────────────────────────────
  async createFinding(input: CreateFindingInput): Promise<ClinicalFinding> {
    if (!input.description?.trim()) {
      throw new Error('Finding description is required');
    }
    return prisma.clinicalFinding.create({
      data: {
        horseId: input.horseId,
        dentalChartId: input.dentalChartId ?? null,
        findingDate: input.findingDate ?? new Date(),
        toothId: input.toothId ?? null,
        category: input.category ?? 'OTHER',
        severity: input.severity ?? 'MILD',
        description: input.description.trim(),
        attachmentId: input.attachmentId ?? null,
        createdById: input.createdById ?? null,
      },
    });
  },

  async listFindings(horseId: string) {
    return prisma.clinicalFinding.findMany({
      where: { horseId },
      orderBy: { findingDate: 'desc' },
      include: {
        attachment: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
  },

  // ─── Prescriptions ────────────────────────────────────────────────────
  async createPrescription(input: CreatePrescriptionInput): Promise<Prescription> {
    if (!input.medicineName?.trim()) throw new Error('Medicine name is required');
    if (!input.dosage?.trim()) throw new Error('Dosage is required');
    if (input.durationDays !== null && input.durationDays !== undefined && input.durationDays < 0) {
      throw new Error('durationDays must be non-negative');
    }
    if (
      input.withdrawalPeriodDays !== null &&
      input.withdrawalPeriodDays !== undefined &&
      input.withdrawalPeriodDays < 0
    ) {
      throw new Error('withdrawalPeriodDays must be non-negative');
    }

    return prisma.prescription.create({
      data: {
        horseId: input.horseId,
        visitRequestId: input.visitRequestId ?? null,
        appointmentId: input.appointmentId ?? null,
        prescribedById: input.prescribedById ?? null,
        prescribedAt: input.prescribedAt ?? new Date(),
        medicineName: input.medicineName.trim(),
        dosage: input.dosage.trim(),
        durationDays: input.durationDays ?? null,
        withdrawalPeriodDays: input.withdrawalPeriodDays ?? null,
        instructions: input.instructions ?? null,
        status: 'ACTIVE',
      },
    });
  },

  async listPrescriptions(horseId: string, status?: PrescriptionStatus) {
    return prisma.prescription.findMany({
      where: { horseId, ...(status ? { status } : {}) },
      orderBy: { prescribedAt: 'desc' },
      include: {
        prescribedBy: { select: { id: true, name: true } },
      },
    });
  },

  async updatePrescriptionStatus(
    id: string,
    status: PrescriptionStatus,
    reason?: string | null,
  ): Promise<Prescription> {
    const now = new Date();
    return prisma.prescription.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? now : null,
        cancelledAt: status === 'CANCELLED' ? now : null,
        cancelledReason: status === 'CANCELLED' ? reason ?? null : null,
      },
    });
  },
};
