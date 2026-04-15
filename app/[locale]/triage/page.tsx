'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
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

interface TriageTask {
  id: string;
  taskType: string;
  status: string;
  notes: string | null;
  createdAt: string;
  visitRequest: {
    id: string;
    urgencyLevel: string;
    requestType: string;
    planningStatus: string;
    horseCount: number | null;
    needsMoreInfo: boolean;
    customer: { id: string; fullName: string } | null;
    yard: { id: string; yardName: string } | null;
    enquiry: { id: string; channel: string; rawText: string } | null;
  };
}

export default function TriagePage() {
  const t = useTranslations('triage');
  const tc = useTranslations('common');
  const [tasks, setTasks] = useState<TriageTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/triage-tasks?pageSize=50')
      .then(r => r.json())
      .then(data => { if (!cancelled) { setTasks(data.data || []); setLoading(false); } });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleAction = async (taskId: string, vrId: string, action: string) => {
    if (action === 'done') {
      await fetch(`/api/triage-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE' }),
      });
    } else if (action === 'planning') {
      await fetch(`/api/visit-requests/${vrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningStatus: 'PLANNING_POOL', needsMoreInfo: false }),
      });
      await fetch(`/api/triage-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE' }),
      });
    }
    setRefreshKey(k => k + 1);
  };

  const taskTypeLabel = (tt: string) => {
    const map: Record<string, string> = {
      URGENT_REVIEW: 'urgentReview',
      ASK_FOR_POSTCODE: 'askPostcode',
      ASK_HORSE_COUNT: 'askHorseCount',
      CLARIFY_SYMPTOMS: 'clarifySymptoms',
      MANUAL_CLASSIFICATION: 'manualClassification',
    };
    return map[tt] || tt;
  };

  // Sort: urgent first, then by date
  const sorted = [...tasks].sort((a, b) => {
    if (a.visitRequest.urgencyLevel === 'URGENT' && b.visitRequest.urgencyLevel !== 'URGENT') return -1;
    if (b.visitRequest.urgencyLevel === 'URGENT' && a.visitRequest.urgencyLevel !== 'URGENT') return 1;
    if (a.visitRequest.needsMoreInfo && !b.visitRequest.needsMoreInfo) return -1;
    if (b.visitRequest.needsMoreInfo && !a.visitRequest.needsMoreInfo) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <PageHeader title={t('title')} subtitle={t('subtitle')} />

          {loading ? <LoadingState /> : sorted.length === 0 ? (
            <EmptyState message={t('empty')} />
          ) : (
            <div className="space-y-3">
              {sorted.map((task) => (
                <Card key={task.id} padding="sm" className={task.visitRequest.urgencyLevel === 'URGENT' ? 'border-danger/30 bg-red-50/50' : task.visitRequest.needsMoreInfo ? 'border-warning/30 bg-amber-50/50' : ''}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge type="urgency" value={task.visitRequest.urgencyLevel} />
                        <StatusBadge type="taskStatus" value={task.status} />
                        <span className="text-xs font-medium text-muted">{t(taskTypeLabel(task.taskType))}</span>
                      </div>
                      <div className="mt-2">
                        {task.visitRequest.customer && (
                          <Link href={`/customers/${task.visitRequest.customer.id}`} className="font-medium text-primary hover:underline">
                            {task.visitRequest.customer.fullName}
                          </Link>
                        )}
                        {task.visitRequest.yard && <span className="ml-2 text-sm text-muted">@ {task.visitRequest.yard.yardName}</span>}
                      </div>
                      {task.visitRequest.enquiry && (
                        <p className="mt-1 truncate text-sm text-muted">{task.visitRequest.enquiry.rawText.slice(0, 80)}</p>
                      )}
                      {task.notes && <p className="mt-1 text-xs text-muted">{task.notes}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {task.visitRequest.enquiry && (
                        <Link href={`/enquiries/${task.visitRequest.enquiry.id}`}>
                          <Button size="sm" variant="ghost">{tc('details')}</Button>
                        </Link>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => handleAction(task.id, task.visitRequest.id, 'planning')}>
                        {t('moveToPlanningPool')}
                      </Button>
                      <Button size="sm" onClick={() => handleAction(task.id, task.visitRequest.id, 'done')}>
                        {t('markDone')}
                      </Button>
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
