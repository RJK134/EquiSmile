'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { taskTypeLabel } from '@/lib/utils/triage-task-type';

interface TriageTask {
  id: string;
  taskType: string;
  status: string;
  notes: string | null;
  escalatedAt: string | null;
  createdAt: string;
  visitRequest: {
    id: string;
    urgencyLevel: string;
    requestType: string;
    planningStatus: string;
    horseCount: number | null;
    needsMoreInfo: boolean;
    estimatedDurationMinutes: number | null;
    autoTriageConfidence: number | null;
    clinicalFlags: string[];
    customer: { id: string; fullName: string } | null;
    yard: { id: string; yardName: string; postcode?: string } | null;
    enquiry: { id: string; channel: string; rawText: string; receivedAt?: string } | null;
  };
}

type SortMode = 'urgency' | 'age' | 'horses';
type FilterUrgency = 'ALL' | 'URGENT' | 'SOON' | 'ROUTINE';
type FilterStatus = 'ALL' | 'OPEN' | 'IN_PROGRESS';

function timeAgo(dateStr: string): { text: string; isOverdue: boolean; minutes: number } {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const isOverdue = minutes > 15; // 15-minute SLA for urgent items
  if (days > 0) return { text: `${days}d`, isOverdue, minutes };
  if (hours > 0) return { text: `${hours}h`, isOverdue, minutes };
  return { text: `${minutes}m`, isOverdue, minutes };
}

export default function TriagePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TriagePageContent />
    </Suspense>
  );
}

function TriagePageContent() {
  const t = useTranslations('triage');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<TriageTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('urgency');
  const [filterUrgency, setFilterUrgency] = useState<FilterUrgency>(
    (searchParams.get('urgency') as FilterUrgency) || 'ALL'
  );
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [overrideModal, setOverrideModal] = useState<{ taskId: string; vrId: string; action: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/triage-tasks?pageSize=100')
      .then(r => r.json())
      .then(data => { if (!cancelled) { setTasks(data.data || []); setLoading(false); } });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const refresh = useCallback(() => {
    setSelected(new Set());
    setRefreshKey(k => k + 1);
  }, []);

  const handleAction = async (taskId: string, vrId: string, action: string) => {
    setActionLoading(true);
    try {
      if (action === 'done') {
        await fetch(`/api/triage-tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DONE' }),
        });
      } else if (action === 'planning') {
        await fetch(`/api/triage-ops/override`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'forceToPool',
            visitRequestId: vrId,
            reason: 'Moved to planning pool from triage queue',
          }),
        });
        await fetch(`/api/triage-tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'DONE' }),
        });
      } else if (action === 'escalate') {
        await fetch(`/api/triage-ops/override`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'forceToUrgentReview',
            visitRequestId: vrId,
            reason: 'Escalated from triage queue',
          }),
        });
      } else if (action === 'requestInfo') {
        await fetch('/api/triage-ops/follow-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitRequestId: vrId }),
        });
      }
    } catch (err) {
      console.error('Action failed:', err);
    }
    setActionLoading(false);
    refresh();
  };

  const handleOverrideSubmit = async () => {
    if (!overrideModal || !overrideReason.trim()) return;
    setActionLoading(true);
    try {
      await fetch(`/api/triage-ops/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: overrideModal.action,
          visitRequestId: overrideModal.vrId,
          reason: overrideReason,
        }),
      });
    } catch (err) {
      console.error('Override failed:', err);
    }
    setActionLoading(false);
    setOverrideModal(null);
    setOverrideReason('');
    refresh();
  };

  const handleBatchAction = async (action: string) => {
    setActionLoading(true);
    const selectedTasks = tasks.filter(t => selected.has(t.id));
    for (const task of selectedTasks) {
      await handleAction(task.id, task.visitRequest.id, action);
    }
    setActionLoading(false);
    refresh();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };


  // Apply filters
  let filtered = [...tasks];
  if (filterUrgency !== 'ALL') {
    filtered = filtered.filter(t => t.visitRequest.urgencyLevel === filterUrgency);
  }
  if (filterStatus !== 'ALL') {
    filtered = filtered.filter(t => t.status === filterStatus);
  }

  // Sort
  filtered.sort((a, b) => {
    if (sortMode === 'urgency') {
      const urgencyOrder: Record<string, number> = { URGENT: 0, SOON: 1, ROUTINE: 2 };
      const diff = (urgencyOrder[a.visitRequest.urgencyLevel] ?? 2) - (urgencyOrder[b.visitRequest.urgencyLevel] ?? 2);
      if (diff !== 0) return diff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortMode === 'age') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortMode === 'horses') {
      return (b.visitRequest.horseCount ?? 0) - (a.visitRequest.horseCount ?? 0);
    }
    return 0;
  });

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <PageHeader title={t('title')} subtitle={t('subtitle')} />

          {/* Filters & Sort Bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value as FilterUrgency)}
            >
              <option value="ALL">{t('filterByUrgency')}: {tc('all')}</option>
              <option value="URGENT">Urgent</option>
              <option value="SOON">Soon</option>
              <option value="ROUTINE">Routine</option>
            </select>
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            >
              <option value="ALL">{t('filterByStatus')}: {tc('all')}</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
            </select>
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="urgency">{t('sortByUrgency')}</option>
              <option value="age">{t('sortByAge')}</option>
              <option value="horses">{t('sortByHorseCount')}</option>
            </select>

            {selected.size > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted">{t('selectedCount', { count: selected.size })}</span>
                <Button size="sm" variant="secondary" onClick={() => handleBatchAction('planning')} disabled={actionLoading}>
                  {t('moveToPlanningPool')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleBatchAction('done')} disabled={actionLoading}>
                  {t('markDone')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  {t('deselectAll')}
                </Button>
              </div>
            )}

            {selected.size === 0 && filtered.length > 0 && (
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set(filtered.map(t => t.id)))}>
                {t('selectAll')}
              </Button>
            )}
          </div>

          {loading ? <LoadingState /> : filtered.length === 0 ? (
            <EmptyState message={t('empty')} />
          ) : (
            <div className="space-y-3">
              {filtered.map((task) => {
                const age = timeAgo(task.createdAt);
                const isUrgent = task.visitRequest.urgencyLevel === 'URGENT';
                const isOverdue = isUrgent && age.isOverdue;

                return (
                  <Card
                    key={task.id}
                    padding="sm"
                    className={
                      isOverdue
                        ? 'border-danger/50 bg-red-50/70 animate-pulse-subtle'
                        : isUrgent
                        ? 'border-danger/30 bg-red-50/50'
                        : task.visitRequest.urgencyLevel === 'SOON'
                        ? 'border-warning/30 bg-amber-50/50'
                        : task.visitRequest.needsMoreInfo
                        ? 'border-warning/20 bg-amber-50/30'
                        : ''
                    }
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      {/* Checkbox */}
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(task.id)}
                          onChange={() => toggleSelect(task.id)}
                          className="mt-1 h-4 w-4 rounded border-border"
                        />
                        <div className="min-w-0 flex-1">
                          {/* Status row */}
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge type="urgency" value={task.visitRequest.urgencyLevel} />
                            <StatusBadge type="taskStatus" value={task.status} />
                            <span className="text-xs font-medium text-muted">{t(taskTypeLabel(task.taskType))}</span>

                            {/* Age / countdown */}
                            <span className={`text-xs font-mono ${isOverdue ? 'font-bold text-danger' : 'text-muted'}`}>
                              {age.text}
                              {isOverdue && ` (${t('overdue')})`}
                            </span>

                            {/* Confidence score */}
                            {task.visitRequest.autoTriageConfidence != null && (
                              <span className="text-xs text-muted">
                                {t('confidence')}: {Math.round(task.visitRequest.autoTriageConfidence * 100)}%
                              </span>
                            )}
                          </div>

                          {/* Customer & Yard */}
                          <div className="mt-2">
                            {task.visitRequest.customer && (
                              <Link href={`/customers/${task.visitRequest.customer.id}`} className="font-medium text-primary hover:underline">
                                {task.visitRequest.customer.fullName}
                              </Link>
                            )}
                            {task.visitRequest.yard && (
                              <span className="ml-2 text-sm text-muted">
                                @ {task.visitRequest.yard.yardName}
                                {task.visitRequest.yard.postcode && ` (${task.visitRequest.yard.postcode})`}
                              </span>
                            )}
                          </div>

                          {/* Message snippet */}
                          {task.visitRequest.enquiry && (
                            <p className="mt-1 truncate text-sm text-muted">{(task.visitRequest.enquiry.rawText || '').slice(0, 100)}</p>
                          )}

                          {/* Extra details row */}
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                            {task.visitRequest.horseCount && (
                              <span>{t('horses', { count: task.visitRequest.horseCount })}</span>
                            )}
                            {task.visitRequest.estimatedDurationMinutes && (
                              <span>{t('estimatedDuration')}: {t('minutesShort', { minutes: task.visitRequest.estimatedDurationMinutes })}</span>
                            )}
                            {task.visitRequest.clinicalFlags.length > 0 && (
                              <span className="text-danger">
                                {t('clinicalFlags')}: {task.visitRequest.clinicalFlags.slice(0, 3).join(', ')}
                              </span>
                            )}
                          </div>

                          {task.notes && <p className="mt-1 text-xs text-muted italic">{task.notes}</p>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        {task.visitRequest.enquiry && (
                          <Link href={`/enquiries/${task.visitRequest.enquiry.id}`}>
                            <Button size="sm" variant="ghost">{tc('details')}</Button>
                          </Link>
                        )}
                        {task.visitRequest.needsMoreInfo && (
                          <Button size="sm" variant="secondary" onClick={() => handleAction(task.id, task.visitRequest.id, 'requestInfo')} disabled={actionLoading}>
                            {t('requestInfo')}
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => handleAction(task.id, task.visitRequest.id, 'planning')} disabled={actionLoading}>
                          {t('moveToPlanningPool')}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleAction(task.id, task.visitRequest.id, 'escalate')} disabled={actionLoading}>
                          {t('escalate')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setOverrideModal({ taskId: task.id, vrId: task.visitRequest.id, action: 'override' })} disabled={actionLoading}>
                          {t('override')}
                        </Button>
                        <Button size="sm" onClick={() => handleAction(task.id, task.visitRequest.id, 'done')} disabled={actionLoading}>
                          {t('markDone')}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Override Modal */}
          {overrideModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <Card className="w-full max-w-md">
                <h3 className="mb-3 text-sm font-semibold">{t('override')}</h3>
                <textarea
                  className="w-full rounded-md border border-border bg-background p-2 text-sm"
                  rows={3}
                  placeholder={t('overrideReason')}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setOverrideModal(null); setOverrideReason(''); }}>
                    {tc('cancel')}
                  </Button>
                  <Button size="sm" onClick={handleOverrideSubmit} disabled={!overrideReason.trim() || actionLoading}>
                    {tc('confirm')}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
