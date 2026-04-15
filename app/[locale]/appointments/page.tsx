'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Link } from '@/i18n/navigation';

interface Appointment {
  id: string;
  appointmentStart: string;
  appointmentEnd: string;
  status: string;
  confirmationSentAt: string | null;
  reminderSentAt24h: string | null;
  reminderSentAt2h: string | null;
  visitRequest: {
    id: string;
    horseCount: number | null;
    customer: {
      id: string;
      fullName: string;
    };
    yard: {
      id: string;
      yardName: string;
      town: string;
      postcode: string;
    } | null;
  };
  routeRun: {
    id: string;
    runDate: string;
    status: string;
  } | null;
}

export default function AppointmentsPage() {
  const t = useTranslations('appointments');
  const tc = useTranslations('common');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchAppointments = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('pageSize', '50');

    fetch(`/api/appointments?${params}`)
      .then((r) => r.json())
      .then((result) => {
        setAppointments(result.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dateFrom, dateTo]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString();

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <PageHeader title={t('title')} subtitle={t('subtitle')} />

          {/* Filters */}
          <Card className="mb-6">
            <h3 className="mb-3 text-sm font-semibold">{t('filters')}</h3>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted">{t('status')}</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">{t('allStatuses')}</option>
                  <option value="PROPOSED">Proposed</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="NO_SHOW">No-Show</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">{t('from')}</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">{t('to')}</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          </Card>

          {loading ? (
            <LoadingState />
          ) : appointments.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">{t('empty')}</p>
            </Card>
          ) : (
            <>
              {/* Mobile: Card List */}
              <div className="space-y-3 lg:hidden">
                {appointments.map((appt) => (
                  <Link key={appt.id} href={`/appointments/${appt.id}`}>
                    <Card className="hover:border-primary/30">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            {appt.visitRequest.customer.fullName}
                          </p>
                          <p className="text-xs text-muted">
                            {appt.visitRequest.yard?.yardName ?? '—'}
                          </p>
                        </div>
                        <StatusBadge type="appointment" value={appt.status} />
                      </div>
                      <div className="mt-2 flex gap-4 text-xs text-muted">
                        <span>{formatDate(appt.appointmentStart)}</span>
                        <span>{formatTime(appt.appointmentStart)} – {formatTime(appt.appointmentEnd)}</span>
                        <span>{appt.visitRequest.horseCount ?? '?'} {t('horses')}</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Desktop: Table */}
              <Card className="hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted">
                        <th className="pb-2 pr-3">{t('date')}</th>
                        <th className="pb-2 pr-3">{t('time')}</th>
                        <th className="pb-2 pr-3">{t('customer')}</th>
                        <th className="pb-2 pr-3">{t('yard')}</th>
                        <th className="pb-2 pr-3">{t('horses')}</th>
                        <th className="pb-2 pr-3">{t('status')}</th>
                        <th className="pb-2 pr-3">{t('confirmationStatus')}</th>
                        <th className="pb-2">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((appt) => (
                        <tr key={appt.id} className="border-b border-border/50">
                          <td className="py-2 pr-3">{formatDate(appt.appointmentStart)}</td>
                          <td className="py-2 pr-3">
                            {formatTime(appt.appointmentStart)} – {formatTime(appt.appointmentEnd)}
                          </td>
                          <td className="py-2 pr-3">
                            <Link
                              href={`/customers/${appt.visitRequest.customer.id}`}
                              className="text-primary hover:underline"
                            >
                              {appt.visitRequest.customer.fullName}
                            </Link>
                          </td>
                          <td className="py-2 pr-3">
                            {appt.visitRequest.yard ? (
                              <Link
                                href={`/yards/${appt.visitRequest.yard.id}`}
                                className="text-primary hover:underline"
                              >
                                {appt.visitRequest.yard.yardName}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 pr-3">{appt.visitRequest.horseCount ?? '—'}</td>
                          <td className="py-2 pr-3">
                            <StatusBadge type="appointment" value={appt.status} />
                          </td>
                          <td className="py-2 pr-3">
                            {appt.confirmationSentAt ? (
                              <span className="text-xs text-green-600">{t('confirmed')}</span>
                            ) : (
                              <span className="text-xs text-muted">{t('notConfirmed')}</span>
                            )}
                          </td>
                          <td className="py-2">
                            <Link href={`/appointments/${appt.id}`}>
                              <Button size="sm" variant="ghost">{tc('view')}</Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
