'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Link } from '@/i18n/navigation';

interface DashboardAppointment {
  id: string;
  appointmentStart: string;
  appointmentEnd: string;
  status: string;
  visitRequest: {
    customer: { id: string; fullName: string };
    yard: { yardName: string } | null;
    horseCount: number | null;
  };
}

interface DashboardData {
  stats: {
    urgentCount: number;
    needsInfoCount: number;
    planningPoolCount: number;
    activeCustomers: number;
  };
  recentEnquiries: Array<{
    id: string;
    channel: string;
    triageStatus: string;
    rawText: string;
    receivedAt: string;
    customer: { id: string; fullName: string } | null;
  }>;
  urgentRequests: Array<{
    id: string;
    urgencyLevel: string;
    requestType: string;
    customer: { id: string; fullName: string };
    yard: { id: string; yardName: string } | null;
    enquiry: { id: string } | null;
  }>;
  openTriageTasks: Array<{
    id: string;
    taskType: string;
    visitRequest: {
      id: string;
      customer: { id: string; fullName: string } | null;
    };
  }>;
  sla: {
    urgentOverdueCount: number;
    missingInfoAgingCount: number;
    triagedTodayCount: number;
    triagedWeekCount: number;
    autoTriageRate: number;
    openTaskCount: number;
  };
  appointments?: {
    todayCount: number;
    todayAppointments: DashboardAppointment[];
    upcomingCount: number;
    upcomingAppointments: DashboardAppointment[];
    pendingConfirmations: number;
    completedThisWeek: number;
    followUpsDue: number;
  };
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const ta = useTranslations('appointments.dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <PageHeader title={t('title')} subtitle={t('subtitle')} />

          {loading ? <LoadingState /> : !data ? (
            <Card><p className="text-sm text-muted">{tc('error')}</p></Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Link href="/triage">
                  <Card className="hover:border-primary/30">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted">{t('urgentToday')}</p>
                      {data.sla?.openTaskCount > 0 && (
                        <Badge variant="danger">{t('openTasks', { count: data.sla.openTaskCount })}</Badge>
                      )}
                    </div>
                    <p className={`mt-1 text-3xl font-bold ${data.stats.urgentCount > 0 ? 'text-danger' : ''}`}>
                      {data.stats.urgentCount}
                    </p>
                  </Card>
                </Link>
                <Link href="/triage">
                  <Card className="hover:border-primary/30">
                    <p className="text-sm font-medium text-muted">{t('needsInfo')}</p>
                    <p className={`mt-1 text-3xl font-bold ${data.stats.needsInfoCount > 0 ? 'text-warning' : ''}`}>
                      {data.stats.needsInfoCount}
                    </p>
                  </Card>
                </Link>
                <Link href="/planning">
                  <Card className="hover:border-primary/30">
                    <p className="text-sm font-medium text-muted">{t('planningPool')}</p>
                    <p className="mt-1 text-3xl font-bold">{data.stats.planningPoolCount}</p>
                  </Card>
                </Link>
                <Link href="/customers">
                  <Card className="hover:border-primary/30">
                    <p className="text-sm font-medium text-muted">{t('activeCustomers')}</p>
                    <p className="mt-1 text-3xl font-bold">{data.stats.activeCustomers}</p>
                  </Card>
                </Link>
              </div>

              {/* SLA Overview */}
              {data.sla && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Urgent SLA */}
                  <Card className={data.sla.urgentOverdueCount > 0 ? 'border-danger/30 bg-red-50/50' : ''}>
                    <p className="text-xs font-semibold text-muted">{t('urgentSla')}</p>
                    {data.sla.urgentOverdueCount > 0 ? (
                      <p className="mt-1 text-sm font-bold text-danger">
                        {t('urgentOverdue', { count: data.sla.urgentOverdueCount })}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-green-600">{t('allUrgentReviewed')}</p>
                    )}
                  </Card>

                  {/* Missing Info Aging */}
                  <Card className={data.sla.missingInfoAgingCount > 0 ? 'border-warning/30 bg-amber-50/50' : ''}>
                    <p className="text-xs font-semibold text-muted">{t('missingInfoAging')}</p>
                    {data.sla.missingInfoAgingCount > 0 ? (
                      <p className="mt-1 text-sm font-bold text-warning">
                        {t('waitingOver48h', { count: data.sla.missingInfoAgingCount })}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-green-600">{t('allInfoRecent')}</p>
                    )}
                  </Card>

                  {/* Triage Throughput */}
                  <Card>
                    <p className="text-xs font-semibold text-muted">{t('triageThroughput')}</p>
                    <div className="mt-1 flex items-baseline gap-3">
                      <div>
                        <span className="text-2xl font-bold">{data.sla.triagedTodayCount}</span>
                        <span className="ml-1 text-xs text-muted">{t('triagedToday')}</span>
                      </div>
                      <div className="text-sm text-muted">
                        {data.sla.triagedWeekCount} {t('triagedThisWeek')}
                      </div>
                    </div>
                  </Card>

                  {/* Auto-Triage Rate */}
                  <Card>
                    <p className="text-xs font-semibold text-muted">{t('autoTriageRate')}</p>
                    <p className="mt-1 text-2xl font-bold">
                      {t('autoTriageSuccess', { rate: data.sla.autoTriageRate })}
                    </p>
                  </Card>
                </div>
              )}

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {/* Urgent Items */}
                <Card>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{t('urgentItems')}</h3>
                    <Link href="/triage" className="text-xs text-primary hover:underline">{t('viewAll')}</Link>
                  </div>
                  {data.urgentRequests.length === 0 ? (
                    <p className="text-sm text-muted">{t('noUrgent')}</p>
                  ) : (
                    <div className="space-y-2">
                      {data.urgentRequests.slice(0, 5).map((vr) => (
                        <div key={vr.id} className="flex items-center justify-between rounded-md border border-danger/20 bg-red-50/50 px-3 py-2 text-sm">
                          <div>
                            <Link href={`/customers/${vr.customer.id}`} className="font-medium text-primary hover:underline">{vr.customer.fullName}</Link>
                            {vr.yard && <span className="ml-2 text-xs text-muted">@ {vr.yard.yardName}</span>}
                          </div>
                          <StatusBadge type="urgency" value={vr.urgencyLevel} />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Triage Tasks */}
                <Card>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{t('needsInfoItems')}</h3>
                      {data.sla?.openTaskCount > 0 && (
                        <Badge variant="warning">{data.sla.openTaskCount}</Badge>
                      )}
                    </div>
                    <Link href="/triage" className="text-xs text-primary hover:underline">{t('viewAll')}</Link>
                  </div>
                  {data.openTriageTasks.length === 0 ? (
                    <p className="text-sm text-muted">{t('noNeedsInfo')}</p>
                  ) : (
                    <div className="space-y-2">
                      {data.openTriageTasks.slice(0, 5).map((task) => (
                        <div key={task.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                          <span>{task.visitRequest.customer?.fullName || '\u2014'}</span>
                          <span className="text-xs text-muted">{task.taskType}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Recent Enquiries */}
              <Card className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t('recentEnquiries')}</h3>
                  <Link href="/enquiries" className="text-xs text-primary hover:underline">{t('viewAll')}</Link>
                </div>
                {data.recentEnquiries.length === 0 ? (
                  <p className="text-sm text-muted">{t('noEnquiries')}</p>
                ) : (
                  <div className="space-y-2">
                    {data.recentEnquiries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <Link href={`/enquiries/${e.id}`} className="truncate font-medium text-primary hover:underline">
                            {e.rawText.slice(0, 50)}
                          </Link>
                          <p className="text-xs text-muted">{e.customer?.fullName || '\u2014'} &middot; {new Date(e.receivedAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <StatusBadge type="channel" value={e.channel} />
                          <StatusBadge type="triage" value={e.triageStatus} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Appointments Section */}
              {data.appointments && (
                <>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Link href="/appointments">
                      <Card className="hover:border-primary/30">
                        <p className="text-sm font-medium text-muted">{ta('todayCount')}</p>
                        <p className="mt-1 text-3xl font-bold">{data.appointments.todayCount}</p>
                      </Card>
                    </Link>
                    <Link href="/appointments">
                      <Card className="hover:border-primary/30">
                        <p className="text-sm font-medium text-muted">{ta('upcoming')}</p>
                        <p className="mt-1 text-3xl font-bold">{data.appointments.upcomingCount}</p>
                      </Card>
                    </Link>
                    <Card className={data.appointments.pendingConfirmations > 0 ? 'border-warning/30 bg-amber-50/50' : ''}>
                      <p className="text-sm font-medium text-muted">{ta('pendingConfirmations')}</p>
                      <p className={`mt-1 text-3xl font-bold ${data.appointments.pendingConfirmations > 0 ? 'text-warning' : ''}`}>
                        {data.appointments.pendingConfirmations}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-sm font-medium text-muted">{ta('completedThisWeek')}</p>
                      <p className="mt-1 text-3xl font-bold">{data.appointments.completedThisWeek}</p>
                    </Card>
                  </div>

                  {data.appointments.followUpsDue > 0 && (
                    <Card className="mt-4 border-warning/30 bg-amber-50/50">
                      <p className="text-sm font-medium text-warning">
                        {ta('followUpsDue')}: {data.appointments.followUpsDue}
                      </p>
                    </Card>
                  )}

                  {data.appointments.todayAppointments.length > 0 && (
                    <Card className="mt-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{ta('todayCount')}</h3>
                        <Link href="/appointments" className="text-xs text-primary hover:underline">{t('viewAll')}</Link>
                      </div>
                      <div className="space-y-2">
                        {data.appointments.todayAppointments.map((appt) => (
                          <div key={appt.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                            <div>
                              <Link href={`/appointments/${appt.id}`} className="font-medium text-primary hover:underline">
                                {appt.visitRequest.customer.fullName}
                              </Link>
                              <span className="ml-2 text-xs text-muted">
                                @ {appt.visitRequest.yard?.yardName ?? '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted">
                                {new Date(appt.appointmentStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <StatusBadge type="appointment" value={appt.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
