'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Link } from '@/i18n/navigation';
import { selectStyles } from '@/components/ui/FormField';

interface CompletedVisit {
  id: string;
  appointmentStart: string;
  appointmentEnd: string;
  status: string;
  visitRequest: {
    id: string;
    horseCount: number | null;
    urgencyLevel: string;
    requestType: string;
    customer: { id: string; fullName: string };
    yard: { id: string; yardName: string; postcode: string } | null;
  };
  visitOutcome: {
    id: string;
    completedAt: string;
    notes: string | null;
    followUpRequired: boolean;
    followUpDueDate: string | null;
    nextDentalDueDate: string | null;
    invoiceStatus: string;
  } | null;
}

export default function CompletedPage() {
  const t = useTranslations('completed');
  const [visits, setVisits] = useState<CompletedVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'followUp' | 'overdue'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ status: 'COMPLETED', pageSize: '100' });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    const controller = new AbortController();
    fetch(`/api/appointments?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setVisits(json.data || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVisits([]);
          setLoading(false);
        }
      });

    return () => { cancelled = true; controller.abort(); };
  }, [dateFrom, dateTo]);

  const overdueVisits = visits.filter(
    (v) =>
      v.visitOutcome?.followUpRequired &&
      v.visitOutcome?.followUpDueDate &&
      new Date(v.visitOutcome.followUpDueDate) < new Date(),
  );

  const filteredVisits =
    filter === 'followUp'
      ? visits.filter((v) => v.visitOutcome?.followUpRequired)
      : filter === 'overdue'
        ? overdueVisits
        : visits;

  const followUpCount = visits.filter((v) => v.visitOutcome?.followUpRequired).length;

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <PageHeader
            title={t('title')}
            subtitle={t('subtitle')}
          />

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'followUp' | 'overdue')}
              className={`${selectStyles} sm:max-w-[220px]`}
            >
              <option value="all">{t('allCompleted')}</option>
              <option value="followUp">{t('followUpOnly')} ({followUpCount})</option>
              <option value="overdue">{t('overdueOnly')} ({overdueVisits.length})</option>
            </select>

            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">{t('from')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">{t('to')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Stats bar */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card padding="sm">
              <p className="text-xs text-muted">{t('totalCompleted')}</p>
              <p className="text-xl font-bold">{visits.length}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-muted">{t('followUpsRequired')}</p>
              <p className="text-xl font-bold text-amber-600">{followUpCount}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-muted">{t('overdueFollowUps')}</p>
              <p className="text-xl font-bold text-red-600">
                {overdueVisits.length}
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-muted">{t('invoicesPending')}</p>
              <p className="text-xl font-bold">
                {visits.filter((v) => v.visitOutcome?.invoiceStatus === 'PENDING').length}
              </p>
            </Card>
          </div>

          {loading ? (
            <LoadingState />
          ) : filteredVisits.length === 0 ? (
            <EmptyState message={t('empty')} />
          ) : (
            <div className="space-y-3">
              {/* Desktop table */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="pb-2 pr-3">{t('date')}</th>
                      <th className="pb-2 pr-3">{t('customer')}</th>
                      <th className="pb-2 pr-3">{t('yard')}</th>
                      <th className="pb-2 pr-3">{t('horses')}</th>
                      <th className="pb-2 pr-3">{t('outcome')}</th>
                      <th className="pb-2 pr-3">{t('followUp')}</th>
                      <th className="pb-2">{t('invoice')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.map((visit) => (
                      <tr key={visit.id} className="border-b border-border/50">
                        <td className="py-2 pr-3">
                          <Link href={`/appointments/${visit.id}`} className="text-primary hover:underline">
                            {new Date(visit.appointmentStart).toLocaleDateString()}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          <Link href={`/customers/${visit.visitRequest.customer.id}`} className="text-primary hover:underline">
                            {visit.visitRequest.customer.fullName}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {visit.visitRequest.yard ? (
                            <Link href={`/yards/${visit.visitRequest.yard.id}`} className="text-primary hover:underline">
                              {visit.visitRequest.yard.yardName}
                            </Link>
                          ) : '-'}
                        </td>
                        <td className="py-2 pr-3">{visit.visitRequest.horseCount ?? '-'}</td>
                        <td className="py-2 pr-3">
                          <span className="text-xs text-muted">
                            {visit.visitOutcome?.notes
                              ? visit.visitOutcome.notes.length > 60
                                ? `${visit.visitOutcome.notes.slice(0, 60)}...`
                                : visit.visitOutcome.notes
                              : '-'}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          {visit.visitOutcome?.followUpRequired ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              visit.visitOutcome.followUpDueDate && new Date(visit.visitOutcome.followUpDueDate) < new Date()
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                              {visit.visitOutcome.followUpDueDate
                                ? new Date(visit.visitOutcome.followUpDueDate).toLocaleDateString()
                                : t('required')}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">-</span>
                          )}
                        </td>
                        <td className="py-2">
                          {visit.visitOutcome ? (
                            <StatusBadge type="planning" value={visit.visitOutcome.invoiceStatus} />
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 lg:hidden">
                {filteredVisits.map((visit) => (
                  <Link key={visit.id} href={`/appointments/${visit.id}`}>
                    <Card padding="sm" className="transition-colors hover:bg-surface">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{visit.visitRequest.customer.fullName}</p>
                          <p className="text-xs text-muted">
                            {visit.visitRequest.yard?.yardName || ''} &middot; {new Date(visit.appointmentStart).toLocaleDateString()}
                          </p>
                        </div>
                        {visit.visitOutcome?.followUpRequired && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            visit.visitOutcome.followUpDueDate && new Date(visit.visitOutcome.followUpDueDate) < new Date()
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {t('followUp')}
                          </span>
                        )}
                      </div>
                      {visit.visitOutcome?.notes && (
                        <p className="mt-1 text-xs text-muted">
                          {visit.visitOutcome.notes.length > 80
                            ? `${visit.visitOutcome.notes.slice(0, 80)}...`
                            : visit.visitOutcome.notes}
                        </p>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
