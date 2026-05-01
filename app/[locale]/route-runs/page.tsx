'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Link } from '@/i18n/navigation';
import { selectStyles } from '@/components/ui/FormField';
import { RouteMap } from '@/components/maps/RouteMap';

interface RouteRunSummary {
  id: string;
  runDate: string;
  status: string;
  homeBaseAddress?: string;
  totalDistanceMeters: number | null;
  totalTravelMinutes: number | null;
  totalVisitMinutes: number | null;
  totalJobs: number | null;
  totalHorses: number | null;
  optimizationScore: number | null;
  _count: { stops: number };
  stops?: Array<{
    sequenceNo: number;
    yard: {
      yardName: string;
      postcode: string;
      town?: string;
      latitude: number | null;
      longitude: number | null;
    };
  }>;
}

export default function RouteRunsPage() {
  const t = useTranslations('routeRuns');
  const tc = useTranslations('common');
  const format = useFormatter();
  const [routeRuns, setRouteRuns] = useState<RouteRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState('');

  const fetchRouteRuns = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: '50' });
    if (statusFilter) params.set('status', statusFilter);

    const res = await fetch(`/api/route-planning/proposals?${params}`);
    const json = await res.json();
    setRouteRuns(json.data || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRouteRuns();
  }, [fetchRouteRuns]);

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage('');
    try {
      const res = await fetch('/api/route-planning/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.proposalCount > 0) {
        setMessage(t('generated', { count: json.proposalCount }));
        await fetchRouteRuns();
      } else {
        setMessage(t('noEligible'));
      }
    } catch {
      setMessage(tc('error'));
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return format.dateTime(new Date(dateStr), { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null) return '-';
    if (minutes < 60) return `${minutes} ${t('detail.min')}`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}${t('detail.hrs')} ${mins}${t('detail.min')}`;
  };

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
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? t('generating') : t('generateRoutes')}
              </Button>
            }
          />

          {message && (
            <div className="mb-4 rounded-md border border-border bg-surface p-3 text-sm">
              {message}
            </div>
          )}

          <div className="mb-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`${selectStyles} sm:max-w-[200px]`}
            >
              <option value="">{tc('all')}</option>
              <option value="DRAFT">{t('draft')}</option>
              <option value="PROPOSED">{t('proposed')}</option>
              <option value="APPROVED">{t('approved')}</option>
            </select>
          </div>

          {loading ? (
            <LoadingState />
          ) : routeRuns.length === 0 ? (
            <EmptyState message={t('empty')} />
          ) : (
            <div className="space-y-3">
              {routeRuns.map((run) => (
                <Link key={run.id} href={`/route-runs/${run.id}`}>
                  <Card padding="sm" className="transition-colors hover:bg-surface">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatDate(run.runDate)}</span>
                          <StatusBadge type="planning" value={run.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                          <span>{run._count?.stops ?? run.totalJobs ?? 0} {t('stops')}</span>
                          <span>{run.totalHorses ?? 0} {t('horses')}</span>
                          <span>{formatMinutes(run.totalTravelMinutes)}</span>
                          {run.optimizationScore !== null && (
                            <span>{t('score')}: {run.optimizationScore}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-primary">{t('viewDetail')}</span>
                    </div>
                    {run.stops && run.stops.length > 0 && (
                      <div className="mt-2">
                        <RouteMap
                          compact
                          stops={run.stops
                            .filter((s) => s.yard.latitude != null && s.yard.longitude != null)
                            .map((s) => ({
                              sequenceNo: s.sequenceNo,
                              yardName: s.yard.yardName,
                              postcode: s.yard.postcode,
                              town: s.yard.town,
                              latitude: s.yard.latitude!,
                              longitude: s.yard.longitude!,
                            }))}
                          homeBase={{
                            latitude: parseFloat(process.env.NEXT_PUBLIC_HOME_BASE_LAT || '46.4553'),
                            longitude: parseFloat(process.env.NEXT_PUBLIC_HOME_BASE_LNG || '6.8561'),
                            label: run.homeBaseAddress || 'Home Base',
                          }}
                        />
                      </div>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
