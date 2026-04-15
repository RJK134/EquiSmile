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
import { Button } from '@/components/ui/Button';
import { Link, useRouter } from '@/i18n/navigation';
import { selectStyles } from '@/components/ui/FormField';

interface PlanningItem {
  id: string;
  requestType: string;
  urgencyLevel: string;
  planningStatus: string;
  horseCount: number | null;
  preferredDays: string[];
  preferredTimeBand: string;
  customer: { id: string; fullName: string };
  yard: { id: string; yardName: string; postcode: string; areaLabel: string | null } | null;
}

export default function PlanningPage() {
  const t = useTranslations('planning');
  const tc = useTranslations('common');
  const tReq = useTranslations('requestTypes');
  const router = useRouter();
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [requestTypeFilter, setRequestTypeFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ pageSize: '100' });
    // Fetch planning pool + ready for review
    Promise.all([
      fetch(`/api/visit-requests?planningStatus=PLANNING_POOL&${params}`).then(r => r.json()),
      fetch(`/api/visit-requests?planningStatus=READY_FOR_REVIEW&${params}`).then(r => r.json()),
    ]).then(([poolData, reviewData]) => {
      if (!cancelled) {
        setItems([...(poolData.data || []), ...(reviewData.data || [])]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const requestTypeKey = (rt: string) => {
    const map: Record<string, string> = { ROUTINE_DENTAL: 'routineDental', FOLLOW_UP: 'followUp', URGENT_ISSUE: 'urgentIssue', FIRST_VISIT: 'firstVisit', ADMIN: 'admin' };
    return map[rt] || rt;
  };

  // Filter
  let filtered = items;
  if (urgencyFilter) filtered = filtered.filter((i) => i.urgencyLevel === urgencyFilter);
  if (requestTypeFilter) filtered = filtered.filter((i) => i.requestType === requestTypeFilter);

  // Group by area
  const groups = new Map<string, PlanningItem[]>();
  for (const item of filtered) {
    const key = item.yard?.areaLabel || item.yard?.postcode?.slice(0, 3) || 'Unassigned';
    const existing = groups.get(key) || [];
    existing.push(item);
    groups.set(key, existing);
  }

  const groupEntries = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <PageHeader
            title={t('title')}
            subtitle={t('subtitle')}
            action={
              <Button onClick={() => router.push('/route-runs')}>
                {t('generateRoutes')}
              </Button>
            }
          />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)} className={`${selectStyles} sm:max-w-[200px]`}>
              <option value="">{tc('all')}</option>
              <option value="URGENT">Urgent</option>
              <option value="SOON">Soon</option>
              <option value="ROUTINE">Routine</option>
            </select>
            <select value={requestTypeFilter} onChange={(e) => setRequestTypeFilter(e.target.value)} className={`${selectStyles} sm:max-w-[200px]`}>
              <option value="">{tc('all')}</option>
              <option value="ROUTINE_DENTAL">{tReq('routineDental')}</option>
              <option value="FOLLOW_UP">{tReq('followUp')}</option>
              <option value="URGENT_ISSUE">{tReq('urgentIssue')}</option>
              <option value="FIRST_VISIT">{tReq('firstVisit')}</option>
            </select>
          </div>

          {loading ? <LoadingState /> : filtered.length === 0 ? (
            <EmptyState message={t('empty')} />
          ) : (
            <div className="space-y-6">
              {groupEntries.map(([area, groupItems]) => (
                <div key={area}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {t('area')}: {area}
                    </h3>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {groupItems.length} {t('jobs')}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {groupItems.map((item) => (
                      <Card key={item.id} padding="sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/customers/${item.customer.id}`} className="font-medium text-primary hover:underline">
                                {item.customer.fullName}
                              </Link>
                              {item.yard && <span className="text-sm text-muted">@ {item.yard.yardName}</span>}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                              <span>{tReq(requestTypeKey(item.requestType))}</span>
                              {item.horseCount && <span>{item.horseCount} {t('horsesCount')}</span>}
                              {item.preferredDays.length > 0 && <span>{item.preferredDays.join(', ')}</span>}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <StatusBadge type="urgency" value={item.urgencyLevel} />
                            <StatusBadge type="planning" value={item.planningStatus} />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
