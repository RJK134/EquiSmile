'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, use } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Link } from '@/i18n/navigation';

interface RouteRunDetail {
  id: string;
  runDate: string;
  homeBaseAddress: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  totalDistanceMeters: number | null;
  totalTravelMinutes: number | null;
  totalVisitMinutes: number | null;
  totalJobs: number | null;
  totalHorses: number | null;
  optimizationScore: number | null;
  notes: string | null;
  stops: Array<{
    id: string;
    sequenceNo: number;
    yardId: string;
    visitRequestId: string | null;
    plannedArrival: string | null;
    plannedDeparture: string | null;
    serviceMinutes: number | null;
    travelFromPrevMinutes: number | null;
    travelFromPrevMeters: number | null;
    stopStatus: string;
    yard: {
      id: string;
      yardName: string;
      addressLine1: string;
      town: string;
      postcode: string;
      customer: { id: string; fullName: string };
    };
    visitRequest: {
      id: string;
      horseCount: number | null;
      urgencyLevel: string;
      customer: { id: string; fullName: string };
    } | null;
  }>;
}

export default function RouteRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('routeRuns.detail');
  const tr = useTranslations('routeRuns');
  const tc = useTranslations('common');
  const [routeRun, setRouteRun] = useState<RouteRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/route-planning/proposals/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setRouteRun(data);
        setLoading(false);
      });
  }, [id]);

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/route-planning/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      setRouteRun((prev) => (prev ? { ...prev, status: data.status } : prev));
    } finally {
      setUpdating(false);
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDistance = (meters: number | null) => {
    if (meters === null) return '-';
    return `${(meters / 1000).toFixed(1)} ${t('km')}`;
  };

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null) return '-';
    if (minutes < 60) return `${minutes} ${t('min')}`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}${t('hrs')} ${mins}${t('min')}`;
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
            <LoadingState />
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!routeRun) {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
            <p>{tc('error')}</p>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <div className="mb-2">
            <Link href="/route-runs" className="text-sm text-primary hover:underline">
              {tc('back')}
            </Link>
          </div>

          <PageHeader
            title={t('title')}
            subtitle={new Date(routeRun.runDate).toLocaleDateString()}
          />

          {/* Summary Card */}
          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-semibold">{t('summary')}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <span className="text-xs text-muted">{t('runDate')}</span>
                <p className="font-medium">{new Date(routeRun.runDate).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('startTime')}</span>
                <p className="font-medium">{formatTime(routeRun.startTime)}</p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('endTime')}</span>
                <p className="font-medium">{formatTime(routeRun.endTime)}</p>
              </div>
              <div>
                <span className="text-xs text-muted">{tr('status')}</span>
                <p><StatusBadge type="planning" value={routeRun.status} /></p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('totalDistance')}</span>
                <p className="font-medium">{formatDistance(routeRun.totalDistanceMeters)}</p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('totalTravel')}</span>
                <p className="font-medium">{formatMinutes(routeRun.totalTravelMinutes)}</p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('totalService')}</span>
                <p className="font-medium">{formatMinutes(routeRun.totalVisitMinutes)}</p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('totalHorses')}</span>
                <p className="font-medium">{routeRun.totalHorses ?? '-'}</p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('totalStops')}</span>
                <p className="font-medium">{routeRun.stops.length}</p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('optimizationScore')}</span>
                <p className="font-medium">{routeRun.optimizationScore ?? '-'}</p>
              </div>
            </div>
          </Card>

          {/* Actions */}
          {(routeRun.status === 'DRAFT' || routeRun.status === 'PROPOSED') && (
            <div className="mb-6 flex gap-2">
              <Button
                onClick={() => handleStatusUpdate('APPROVED')}
                disabled={updating}
              >
                {tr('approve')}
              </Button>
              <Button
                variant="danger"
                onClick={() => handleStatusUpdate('DRAFT')}
                disabled={updating || routeRun.status === 'DRAFT'}
              >
                {tr('reject')}
              </Button>
            </div>
          )}

          {/* Stops List */}
          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-semibold">{t('stopList')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="pb-2 pr-3">{t('sequence')}</th>
                    <th className="pb-2 pr-3">{t('yard')}</th>
                    <th className="pb-2 pr-3">{t('customer')}</th>
                    <th className="pb-2 pr-3">{t('horseCount')}</th>
                    <th className="pb-2 pr-3">{t('arrival')}</th>
                    <th className="pb-2 pr-3">{t('departure')}</th>
                    <th className="pb-2 pr-3">{t('travelFromPrev')}</th>
                    <th className="pb-2">{t('serviceDuration')}</th>
                  </tr>
                </thead>
                <tbody>
                  {routeRun.stops.map((stop) => (
                    <tr key={stop.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">{stop.sequenceNo}</td>
                      <td className="py-2 pr-3">
                        <Link href={`/yards/${stop.yardId}`} className="text-primary hover:underline">
                          {stop.yard.yardName}
                        </Link>
                        <div className="text-xs text-muted">{stop.yard.postcode}</div>
                      </td>
                      <td className="py-2 pr-3">
                        {stop.visitRequest ? (
                          <Link href={`/customers/${stop.visitRequest.customer.id}`} className="text-primary hover:underline">
                            {stop.visitRequest.customer.fullName}
                          </Link>
                        ) : (
                          stop.yard.customer.fullName
                        )}
                      </td>
                      <td className="py-2 pr-3">{stop.visitRequest?.horseCount ?? '-'}</td>
                      <td className="py-2 pr-3">{formatTime(stop.plannedArrival)}</td>
                      <td className="py-2 pr-3">{formatTime(stop.plannedDeparture)}</td>
                      <td className="py-2 pr-3">{formatMinutes(stop.travelFromPrevMinutes)}</td>
                      <td className="py-2">{formatMinutes(stop.serviceMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Map Placeholder */}
          <Card className="mb-6">
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border bg-surface">
              <div className="text-center text-sm text-muted">
                <p>Map View</p>
                <p className="text-xs">
                  {routeRun.stops.map((s) => `${s.yard.yardName} (${s.yard.postcode})`).join(' → ')}
                </p>
              </div>
            </div>
          </Card>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
