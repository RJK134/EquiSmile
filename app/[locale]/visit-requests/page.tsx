'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { selectStyles } from '@/components/ui/FormField';
import { Link } from '@/i18n/navigation';

interface VisitRequestItem {
  id: string;
  requestType: string;
  urgencyLevel: string;
  planningStatus: string;
  horseCount: number | null;
  preferredDays: string[];
  customer: { id: string; fullName: string };
  yard: { id: string; yardName: string; postcode: string; areaLabel: string | null } | null;
  enquiry: { id: string; channel: string; triageStatus: string } | null;
  _count: { triageTasks: number };
}

export default function VisitRequestsPage() {
  const t = useTranslations('visitRequestsPage');
  const tc = useTranslations('common');
  const tReq = useTranslations('requestTypes');
  const [items, setItems] = useState<VisitRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/visit-requests?pageSize=100')
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setItems(data.data ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (urgencyFilter && item.urgencyLevel !== urgencyFilter) return false;
      if (statusFilter && item.planningStatus !== statusFilter) return false;
      return true;
    });
  }, [items, statusFilter, urgencyFilter]);

  const planningStatuses = useMemo(
    () => Array.from(new Set(items.map((item) => item.planningStatus))).sort(),
    [items],
  );

  const requestTypeKey = (requestType: string) => {
    const map: Record<string, string> = {
      ROUTINE_DENTAL: 'routineDental',
      FOLLOW_UP: 'followUp',
      URGENT_ISSUE: 'urgentIssue',
      FIRST_VISIT: 'firstVisit',
      ADMIN: 'admin',
    };
    return map[requestType] || requestType;
  };

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <PageHeader title={t('title')} subtitle={t('subtitle')} />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <select
              value={urgencyFilter}
              onChange={(event) => setUrgencyFilter(event.target.value)}
              className={`${selectStyles} sm:max-w-[200px]`}
            >
              <option value="">{tc('all')}</option>
              <option value="URGENT">Urgent</option>
              <option value="SOON">Soon</option>
              <option value="ROUTINE">Routine</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={`${selectStyles} sm:max-w-[220px]`}
            >
              <option value="">{tc('all')}</option>
              {planningStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            <EmptyState message={t('empty')} />
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <Card key={item.id}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/customers/${item.customer.id}`} className="font-medium text-primary hover:underline">
                          {item.customer.fullName}
                        </Link>
                        {item.yard ? <span className="text-sm text-muted">@ {item.yard.yardName}</span> : null}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted">
                        <span>{tReq(requestTypeKey(item.requestType))}</span>
                        <span>{t('idLabel', { id: item.id.slice(0, 8) })}</span>
                        {item.horseCount ? <span>{t('horseCount', { count: item.horseCount })}</span> : null}
                        {item._count.triageTasks > 0 ? (
                          <span>{t('tasksOpen', { count: item._count.triageTasks })}</span>
                        ) : null}
                      </div>
                      {item.preferredDays.length > 0 ? (
                        <p className="text-xs text-muted">{t('preferredDays', { days: item.preferredDays.join(', ') })}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge type="urgency" value={item.urgencyLevel} />
                      <StatusBadge type="planning" value={item.planningStatus} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
