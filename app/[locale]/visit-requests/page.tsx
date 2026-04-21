'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Link } from '@/i18n/navigation';

interface VisitRequestRow {
  id: string;
  requestType: string;
  urgencyLevel: string;
  planningStatus: string;
  horseCount: number | null;
  clinicalFlags: string[];
  createdAt: string;
  customer?: { fullName: string } | null;
  yard?: { yardName: string; town?: string | null; postcode?: string | null } | null;
}

/**
 * AMBER-04 remediation — a dedicated operator queue for visit requests.
 * Previously the data was only surfaced via /enquiries/[id] and /planning.
 * This page lists every VisitRequest with its current planning status so
 * operators have a single place to spot stuck/urgent items.
 */
export default function VisitRequestsPage() {
  const t = useTranslations('visitRequests');
  const [rows, setRows] = useState<VisitRequestRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (statusFilter) params.set('planningStatus', statusFilter);
    if (urgencyFilter) params.set('urgencyLevel', urgencyFilter);
    fetch(`/api/visit-requests?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const list: VisitRequestRow[] = Array.isArray(data) ? data : data?.data ?? [];
          setRows(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, urgencyFilter]);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-4">
          <div className="mx-auto max-w-5xl p-4 lg:p-6">
            <PageHeader title={t('title')} subtitle={t('subtitle')} />

            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">{t('allStatuses')}</option>
                <option value="UNTRIAGED">Untriaged</option>
                <option value="READY_FOR_REVIEW">Ready for review</option>
                <option value="PLANNING_POOL">Planning pool</option>
                <option value="CLUSTERED">Clustered</option>
                <option value="PROPOSED">Proposed</option>
                <option value="BOOKED">Booked</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
              >
                <option value="">{t('allUrgencies')}</option>
                <option value="URGENT">Urgent</option>
                <option value="SOON">Soon</option>
                <option value="ROUTINE">Routine</option>
              </select>
            </div>

            {loading ? (
              <LoadingState />
            ) : !rows || rows.length === 0 ? (
              <EmptyState message={t('empty')} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => (
                  <Card key={row.id} className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {row.customer?.fullName ?? '—'}
                      </span>
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {row.urgencyLevel}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {row.yard?.yardName ?? '—'}
                      {row.yard?.town ? ` · ${row.yard.town}` : ''}
                      {row.yard?.postcode ? ` · ${row.yard.postcode}` : ''}
                    </div>
                    <div className="text-xs text-gray-600">
                      {row.requestType} · {row.horseCount ?? 0} horse(s)
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">{row.planningStatus}</span>
                      <Link
                        href={`/visit-requests/${row.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('open')}
                      </Link>
                    </div>
                    {row.clinicalFlags?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-amber-800">
                        {row.clinicalFlags.map((f) => (
                          <span key={f} className="rounded bg-amber-100 px-1.5 py-0.5">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
