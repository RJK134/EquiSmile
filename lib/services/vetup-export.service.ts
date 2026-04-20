import { prisma } from '@/lib/prisma';
import { encodeCsv, type CsvColumn } from '@/lib/services/csv.service';

/**
 * Phase 11 — VetUp dataset export.
 *
 * VetUp is the external practice-management app the client also uses. The
 * exact column schema depends on the practice's VetUp tenant configuration,
 * so this module exposes several profiles:
 *
 * - `vetup-patient` — horse-centric row (one row per horse, denormalised
 *   owner + yard columns). This is the shape a patient-centric PMS would
 *   most likely import.
 * - `customers`, `horses`, `yards` — per-entity CSVs for power-user diffing
 *   or bulk edits outside the UI.
 *
 * If the client reports a specific VetUp header/column requirement, update
 * the `VETUP_PATIENT_COLUMNS` list below — the CSV encoder stays unchanged.
 */

type HorseRow = {
  id: string;
  horseName: string;
  age: number | null;
  notes: string | null;
  dentalDueDate: Date | null;
  active: boolean;
  customerId: string;
  primaryYardId: string | null;
  customer: { fullName: string; email: string | null; mobilePhone: string | null; preferredLanguage: string };
  primaryYard: { id: string; yardName: string; postcode: string } | null;
};

type CustomerRow = {
  id: string;
  fullName: string;
  email: string | null;
  mobilePhone: string | null;
  preferredChannel: string;
  preferredLanguage: string;
  notes: string | null;
  createdAt: Date;
};

type YardRow = {
  id: string;
  yardName: string;
  customerId: string;
  addressLine1: string;
  addressLine2: string | null;
  town: string;
  county: string | null;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  accessNotes: string | null;
  customer: { fullName: string } | null;
};

export const VETUP_PATIENT_COLUMNS: CsvColumn<HorseRow>[] = [
  { key: 'patient_id', label: 'Patient ID', value: (r) => r.id },
  { key: 'patient_name', label: 'Name', value: (r) => r.horseName },
  { key: 'species', label: 'Species', value: () => 'Horse' },
  { key: 'age', label: 'Age', value: (r) => r.age ?? '' },
  { key: 'dental_due', label: 'Next Dental Due', value: (r) => r.dentalDueDate ?? null },
  { key: 'active', label: 'Active', value: (r) => r.active },
  { key: 'owner_id', label: 'Owner ID', value: (r) => r.customerId },
  { key: 'owner_name', label: 'Owner Name', value: (r) => r.customer.fullName },
  { key: 'owner_email', label: 'Owner Email', value: (r) => r.customer.email ?? '' },
  { key: 'owner_phone', label: 'Owner Phone', value: (r) => r.customer.mobilePhone ?? '' },
  { key: 'owner_language', label: 'Owner Language', value: (r) => r.customer.preferredLanguage },
  { key: 'yard_id', label: 'Yard ID', value: (r) => r.primaryYardId ?? '' },
  { key: 'yard_name', label: 'Yard Name', value: (r) => r.primaryYard?.yardName ?? '' },
  { key: 'yard_postcode', label: 'Yard Postcode', value: (r) => r.primaryYard?.postcode ?? '' },
  { key: 'notes', label: 'Notes', value: (r) => r.notes ?? '' },
];

export const CUSTOMER_COLUMNS: CsvColumn<CustomerRow>[] = [
  { key: 'id', label: 'ID', value: (r) => r.id },
  { key: 'fullName', label: 'Full Name', value: (r) => r.fullName },
  { key: 'email', label: 'Email', value: (r) => r.email ?? '' },
  { key: 'mobilePhone', label: 'Mobile Phone', value: (r) => r.mobilePhone ?? '' },
  { key: 'preferredChannel', label: 'Preferred Channel', value: (r) => r.preferredChannel },
  { key: 'preferredLanguage', label: 'Preferred Language', value: (r) => r.preferredLanguage },
  { key: 'notes', label: 'Notes', value: (r) => r.notes ?? '' },
  { key: 'createdAt', label: 'Created', value: (r) => r.createdAt },
];

export const YARD_COLUMNS: CsvColumn<YardRow>[] = [
  { key: 'id', label: 'ID', value: (r) => r.id },
  { key: 'name', label: 'Yard Name', value: (r) => r.yardName },
  { key: 'customer_id', label: 'Customer ID', value: (r) => r.customerId },
  { key: 'customer_name', label: 'Customer Name', value: (r) => r.customer?.fullName ?? '' },
  { key: 'addressLine1', label: 'Address Line 1', value: (r) => r.addressLine1 },
  { key: 'addressLine2', label: 'Address Line 2', value: (r) => r.addressLine2 ?? '' },
  { key: 'town', label: 'Town', value: (r) => r.town },
  { key: 'county', label: 'County / Canton', value: (r) => r.county ?? '' },
  { key: 'postcode', label: 'Postcode', value: (r) => r.postcode },
  { key: 'latitude', label: 'Latitude', value: (r) => r.latitude ?? '' },
  { key: 'longitude', label: 'Longitude', value: (r) => r.longitude ?? '' },
  { key: 'accessNotes', label: 'Access Notes', value: (r) => r.accessNotes ?? '' },
];

export const vetupExportService = {
  async horsesCsv(): Promise<string> {
    const horses = await prisma.horse.findMany({
      orderBy: { horseName: 'asc' },
      include: { customer: true, primaryYard: true },
    });
    return encodeCsv(horses as HorseRow[], VETUP_PATIENT_COLUMNS);
  },

  async customersCsv(): Promise<string> {
    const customers = await prisma.customer.findMany({ orderBy: { fullName: 'asc' } });
    return encodeCsv(customers as CustomerRow[], CUSTOMER_COLUMNS);
  },

  async yardsCsv(): Promise<string> {
    const yards = await prisma.yard.findMany({
      orderBy: { yardName: 'asc' },
      include: { customer: true },
    });
    return encodeCsv(yards as YardRow[], YARD_COLUMNS);
  },
};
