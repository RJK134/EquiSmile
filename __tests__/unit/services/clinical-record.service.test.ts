import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dentalChart: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    clinicalFinding: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    prescription: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { clinicalRecordService } from '@/lib/services/clinical-record.service';
import { prisma } from '@/lib/prisma';

describe('clinicalRecordService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFinding', () => {
    it('rejects empty description', async () => {
      await expect(
        clinicalRecordService.createFinding({ horseId: 'h1', description: '   ' }),
      ).rejects.toThrow(/description is required/);
    });

    it('trims description and defaults category/severity to OTHER/MILD', async () => {
      (prisma.clinicalFinding.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'f1' });
      await clinicalRecordService.createFinding({
        horseId: 'h1',
        description: '  Sharp enamel point  ',
      });
      const call = (prisma.clinicalFinding.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.description).toBe('Sharp enamel point');
      expect(call.data.category).toBe('OTHER');
      expect(call.data.severity).toBe('MILD');
    });
  });

  describe('createPrescription', () => {
    it('rejects empty medicine name or dosage', async () => {
      await expect(
        clinicalRecordService.createPrescription({ horseId: 'h1', medicineName: '', dosage: 'x' }),
      ).rejects.toThrow(/Medicine name/);
      await expect(
        clinicalRecordService.createPrescription({ horseId: 'h1', medicineName: 'Ibuprofen', dosage: ' ' }),
      ).rejects.toThrow(/Dosage/);
    });

    it('rejects negative durationDays', async () => {
      await expect(
        clinicalRecordService.createPrescription({
          horseId: 'h1',
          medicineName: 'X',
          dosage: 'Y',
          durationDays: -1,
        }),
      ).rejects.toThrow(/durationDays must be non-negative/);
    });

    it('rejects negative withdrawalPeriodDays', async () => {
      await expect(
        clinicalRecordService.createPrescription({
          horseId: 'h1',
          medicineName: 'X',
          dosage: 'Y',
          withdrawalPeriodDays: -2,
        }),
      ).rejects.toThrow(/withdrawalPeriodDays must be non-negative/);
    });

    it('trims medicine name and dosage', async () => {
      (prisma.prescription.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
      await clinicalRecordService.createPrescription({
        horseId: 'h1',
        medicineName: '  Bute  ',
        dosage: '  2g PO SID  ',
      });
      const call = (prisma.prescription.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.medicineName).toBe('Bute');
      expect(call.data.dosage).toBe('2g PO SID');
      expect(call.data.status).toBe('ACTIVE');
    });
  });

  describe('updatePrescriptionStatus', () => {
    it('sets completedAt and clears cancelledAt/Reason when marking COMPLETED', async () => {
      (prisma.prescription.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
      await clinicalRecordService.updatePrescriptionStatus('p1', 'COMPLETED');
      const call = (prisma.prescription.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.status).toBe('COMPLETED');
      expect(call.data.completedAt).toBeInstanceOf(Date);
      expect(call.data.cancelledAt).toBeNull();
      expect(call.data.cancelledReason).toBeNull();
    });

    it('sets cancelledAt and reason when marking CANCELLED', async () => {
      (prisma.prescription.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
      await clinicalRecordService.updatePrescriptionStatus('p1', 'CANCELLED', 'owner declined');
      const call = (prisma.prescription.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.status).toBe('CANCELLED');
      expect(call.data.cancelledAt).toBeInstanceOf(Date);
      expect(call.data.cancelledReason).toBe('owner declined');
      expect(call.data.completedAt).toBeNull();
    });

    it('clears completion/cancellation timestamps when re-activating', async () => {
      (prisma.prescription.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
      await clinicalRecordService.updatePrescriptionStatus('p1', 'ACTIVE');
      const call = (prisma.prescription.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.status).toBe('ACTIVE');
      expect(call.data.completedAt).toBeNull();
      expect(call.data.cancelledAt).toBeNull();
    });
  });
});
