// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HorseClinicalHistory } from '@/components/horses/HorseClinicalHistory';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: 'Clinical history',
      empty: 'No clinical records yet.',
      dentalCharts: 'Dental charts',
      findings: 'Findings',
      prescriptions: 'Prescriptions',
      attachments: 'Attachments',
    };
    return translations[key] ?? key;
  },
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString().slice(0, 10),
  }),
}));

describe('HorseClinicalHistory', () => {
  it('renders the empty state when all relations are empty', () => {
    render(
      <HorseClinicalHistory
        dentalCharts={[]}
        findings={[]}
        prescriptions={[]}
        attachments={[]}
      />,
    );
    expect(screen.getByText('No clinical records yet.')).toBeDefined();
  });

  it('renders dental chart entries with date + notes', () => {
    render(
      <HorseClinicalHistory
        dentalCharts={[
          {
            id: 'c1',
            recordedAt: '2026-04-01T10:00:00Z',
            generalNotes: 'Routine float',
            appointmentId: 'a1',
          },
        ]}
        findings={[]}
        prescriptions={[]}
        attachments={[]}
      />,
    );
    expect(screen.getByText('2026-04-01')).toBeDefined();
    expect(screen.getByText('Routine float')).toBeDefined();
  });

  it('renders clinical findings with tooth code, category, severity, description', () => {
    render(
      <HorseClinicalHistory
        dentalCharts={[]}
        findings={[
          {
            id: 'f1',
            findingDate: '2026-04-01T10:00:00Z',
            toothId: '107',
            category: 'HOOK',
            severity: 'MILD',
            description: 'Mild hook on upper right premolar.',
          },
        ]}
        prescriptions={[]}
        attachments={[]}
      />,
    );
    expect(screen.getByText(/107/)).toBeDefined();
    expect(screen.getByText(/HOOK/)).toBeDefined();
    expect(screen.getByText('Mild hook on upper right premolar.')).toBeDefined();
  });

  it('renders prescriptions with medicine, dosage, status', () => {
    render(
      <HorseClinicalHistory
        dentalCharts={[]}
        findings={[]}
        prescriptions={[
          {
            id: 'p1',
            prescribedAt: '2026-04-01T10:00:00Z',
            medicineName: 'Phenylbutazone (Bute)',
            dosage: '2.2 mg/kg PO BID for 5 days',
            durationDays: 5,
            status: 'ACTIVE',
          },
        ]}
        attachments={[]}
      />,
    );
    expect(screen.getByText('Phenylbutazone (Bute)')).toBeDefined();
    expect(screen.getByText('2.2 mg/kg PO BID for 5 days')).toBeDefined();
    expect(screen.getByText(/active/)).toBeDefined();
  });

  it('renders attachments with kind + description', () => {
    render(
      <HorseClinicalHistory
        dentalCharts={[]}
        findings={[]}
        prescriptions={[]}
        attachments={[
          {
            id: 'att1',
            uploadedAt: '2026-04-01T10:00:00Z',
            kind: 'PHOTO',
            description: 'Pre-floating photo',
          },
        ]}
      />,
    );
    expect(screen.getByText('PHOTO')).toBeDefined();
    expect(screen.getByText('Pre-floating photo')).toBeDefined();
  });

  it('renders a per-section dash placeholder when one relation is empty but others have data', () => {
    render(
      <HorseClinicalHistory
        dentalCharts={[
          {
            id: 'c1',
            recordedAt: '2026-04-01T10:00:00Z',
            generalNotes: 'Annual',
            appointmentId: null,
          },
        ]}
        findings={[]}
        prescriptions={[]}
        attachments={[]}
      />,
    );
    // The dental section renders content; the other 3 sections render the
    // muted dash placeholder. We assert at least one dash exists.
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });
});
