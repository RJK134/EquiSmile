'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';

/**
 * Clinical history card on the horse detail page (G-6a from the May 2026
 * client user-story triage). Renders the newest 5 of each clinical
 * relation already populated by the seed and visit-completion flow:
 *
 * - Dental charts (recordedAt + general notes).
 * - Clinical findings (Triadan tooth code + category + severity + description).
 * - Prescriptions (medicine + dosage + duration + status).
 * - Attachments (kind + description).
 *
 * Empty state per relation: a muted "—" placeholder so the operator
 * sees structure even on a horse with no records yet.
 *
 * Bounded payloads are enforced by the API (`horseRepository.findByIdWithClinicalHistory`)
 * so this component never has to defend against unbounded lists.
 */
export interface DentalChartSummary {
  id: string;
  recordedAt: string;
  generalNotes: string | null;
  appointmentId: string | null;
}

export interface ClinicalFindingSummary {
  id: string;
  findingDate: string;
  toothId: string | null;
  category: string;
  severity: string;
  description: string;
}

export interface PrescriptionSummary {
  id: string;
  prescribedAt: string;
  medicineName: string;
  dosage: string;
  durationDays: number | null;
  status: string;
}

export interface AttachmentSummary {
  id: string;
  uploadedAt: string;
  kind: string;
  description: string | null;
}

export interface HorseClinicalHistoryProps {
  dentalCharts: DentalChartSummary[];
  findings: ClinicalFindingSummary[];
  prescriptions: PrescriptionSummary[];
  attachments: AttachmentSummary[];
}

export function HorseClinicalHistory({
  dentalCharts,
  findings,
  prescriptions,
  attachments,
}: HorseClinicalHistoryProps) {
  const t = useTranslations('horses.clinicalHistory');
  const format = useFormatter();
  const formatDate = (iso: string) =>
    format.dateTime(new Date(iso), { year: 'numeric', month: 'short', day: 'numeric' });

  const isEmpty =
    dentalCharts.length === 0 &&
    findings.length === 0 &&
    prescriptions.length === 0 &&
    attachments.length === 0;

  return (
    <Card className="mt-4">
      <h3 className="mb-3 text-sm font-medium text-muted">{t('title')}</h3>
      {isEmpty ? (
        <p className="text-sm text-muted">{t('empty')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('dentalCharts')}
            </h4>
            {dentalCharts.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {dentalCharts.map((c) => (
                  <li key={c.id}>
                    <p className="font-medium">{formatDate(c.recordedAt)}</p>
                    {c.generalNotes && (
                      <p className="text-muted">{c.generalNotes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('findings')}
            </h4>
            {findings.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {findings.map((f) => (
                  <li key={f.id}>
                    <p className="font-medium">
                      {f.toothId ? `${f.toothId} · ` : ''}
                      {f.category} ({f.severity.toLowerCase()})
                    </p>
                    <p className="text-muted">{f.description}</p>
                    <p className="text-xs text-muted">{formatDate(f.findingDate)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('prescriptions')}
            </h4>
            {prescriptions.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {prescriptions.map((p) => (
                  <li key={p.id}>
                    <p className="font-medium">{p.medicineName}</p>
                    <p className="text-muted">{p.dosage}</p>
                    <p className="text-xs text-muted">
                      {formatDate(p.prescribedAt)}
                      {p.durationDays ? ` · ${p.durationDays}d` : ''}
                      {' · '}
                      {p.status.toLowerCase()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('attachments')}
            </h4>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {attachments.map((a) => (
                  <li key={a.id}>
                    <p className="font-medium">{a.kind}</p>
                    {a.description && (
                      <p className="text-muted">{a.description}</p>
                    )}
                    <p className="text-xs text-muted">{formatDate(a.uploadedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Card>
  );
}
