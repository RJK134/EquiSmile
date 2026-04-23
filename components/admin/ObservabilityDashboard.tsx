'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';

interface ObservabilityDashboardProps {
  locale: string;
}

interface OpsSnapshot {
  takenAt: string;
  deadLetter: {
    pending: number;
    abandoned: number;
    oldestPendingAt: string | null;
  };
  audit: {
    last24h: number;
    latestAt: string | null;
    signIndeniedLast24h: number;
  };
  backup: {
    present: boolean;
    path: string;
    newestFilename: string | null;
    newestAgeHours: number | null;
    newestSizeBytes: number | null;
    totalCount: number;
    totalSizeBytes: number;
    stale: boolean;
    staleAfterHours: number;
  };
}

interface FailedOp {
  id: string;
  scope: string;
  status: 'PENDING' | 'REPLAYED' | 'ABANDONED';
  attempts: number;
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

interface AuditEntry {
  id: string;
  event: string;
  actor: string;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
}

interface Snapshot {
  ops: OpsSnapshot | null;
  deadLetter: FailedOp[];
  audit: AuditEntry[];
}

const REFRESH_INTERVAL_MS = 30_000;

export function ObservabilityDashboard({ locale }: ObservabilityDashboardProps) {
  const t = useTranslations('observability');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/observability', { cache: 'no-store' });
      if (res.status === 403) {
        setError(t('forbidden'));
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as Snapshot;
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // Polling surface — by design, we need to kick a fetch (which
    // setState's the result) both on mount and on interval. The
    // react-hooks/set-state-in-effect rule is too strict for this
    // shape; it's the standard observer pattern the rule itself calls
    // out as a legitimate exception.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const onMarkStatus = useCallback(
    async (id: string, status: 'REPLAYED' | 'ABANDONED') => {
      setActionInFlight(id);
      try {
        const res = await fetch(`/api/admin/observability/failed-operations/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActionInFlight(null);
      }
    },
    [load],
  );

  if (loading && !snapshot) return <LoadingState />;

  if (error && !snapshot) {
    return (
      <Card className="border-amber-300 bg-amber-50 text-sm text-amber-900">
        {error}
      </Card>
    );
  }

  if (!snapshot) return null;

  const { ops, deadLetter, audit } = snapshot;

  return (
    <div className="space-y-6">
      {error && (
        <Card
          padding="sm"
          className="border-amber-300 bg-amber-50 text-sm text-amber-900"
        >
          {t('refreshError')}: {error}
        </Card>
      )}

      <section aria-labelledby="ops-heading" className="space-y-3">
        <h2 id="ops-heading" className="text-lg font-semibold">
          {t('ops.heading')}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard
            label={t('ops.deadLetter.label')}
            value={ops?.deadLetter.pending ?? 0}
            tone={(ops?.deadLetter.pending ?? 0) > 0 ? 'warn' : 'ok'}
            sub={
              ops?.deadLetter.abandoned
                ? t('ops.deadLetter.abandoned', { count: ops.deadLetter.abandoned })
                : null
            }
          />
          <StatCard
            label={t('ops.audit.label')}
            value={ops?.audit.last24h ?? 0}
            tone="ok"
            sub={
              ops?.audit.signIndeniedLast24h
                ? t('ops.audit.signInDenied', {
                    count: ops.audit.signIndeniedLast24h,
                  })
                : null
            }
          />
          <StatCard
            label={t('ops.backup.label')}
            value={ops?.backup.totalCount ?? 0}
            tone={
              !ops?.backup.present
                ? 'warn'
                : ops.backup.stale
                ? 'warn'
                : 'ok'
            }
            sub={
              ops?.backup.newestFilename
                ? t('ops.backup.newest', {
                    age: ops.backup.newestAgeHours?.toFixed(1) ?? '?',
                  })
                : ops?.backup.present
                ? t('ops.backup.none')
                : t('ops.backup.missingVolume')
            }
          />
        </div>
      </section>

      <section aria-labelledby="dlq-heading" className="space-y-3">
        <h2 id="dlq-heading" className="text-lg font-semibold">
          {t('dlq.heading')}
        </h2>
        {deadLetter.length === 0 ? (
          <Card className="text-sm text-gray-600">{t('dlq.empty')}</Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">{t('dlq.scope')}</th>
                  <th className="py-2 pr-3">{t('dlq.status')}</th>
                  <th className="py-2 pr-3">{t('dlq.attempts')}</th>
                  <th className="py-2 pr-3">{t('dlq.lastError')}</th>
                  <th className="py-2 pr-3">{t('dlq.created')}</th>
                  <th className="py-2 pr-3">{t('dlq.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {deadLetter.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{row.scope}</td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={
                          row.status === 'PENDING'
                            ? 'warning'
                            : row.status === 'ABANDONED'
                            ? 'danger'
                            : 'success'
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">{row.attempts}</td>
                    <td className="py-2 pr-3">
                      <span className="block max-w-xs truncate" title={row.lastError}>
                        {row.lastError}
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatTime(row.createdAt, locale)}
                    </td>
                    <td className="py-2 pr-3">
                      {row.status === 'PENDING' && (
                        <div className="flex gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actionInFlight === row.id}
                            onClick={() => onMarkStatus(row.id, 'REPLAYED')}
                          >
                            {t('dlq.markReplayed')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionInFlight === row.id}
                            onClick={() => onMarkStatus(row.id, 'ABANDONED')}
                          >
                            {t('dlq.markAbandoned')}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="audit-heading" className="space-y-3">
        <h2 id="audit-heading" className="text-lg font-semibold">
          {t('audit.heading')}
        </h2>
        {audit.length === 0 ? (
          <Card className="p-4 text-sm text-gray-600">{t('audit.empty')}</Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">{t('audit.when')}</th>
                  <th className="py-2 pr-3">{t('audit.event')}</th>
                  <th className="py-2 pr-3">{t('audit.actor')}</th>
                  <th className="py-2 pr-3">{t('audit.target')}</th>
                  <th className="py-2 pr-3">{t('audit.detail')}</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatTime(row.createdAt, locale)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.event}</td>
                    <td className="py-2 pr-3">
                      <span title={row.actorRole ?? undefined}>{row.actor}</span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-gray-600">
                      {row.targetType}
                      {row.targetId ? (
                        <>
                          <br />
                          <span className="font-mono">{row.targetId}</span>
                        </>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="block max-w-sm truncate" title={row.detail ?? ''}>
                        {row.detail}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string | null;
  tone: 'ok' | 'warn';
}) {
  return (
    <Card className={tone === 'warn' ? 'border-amber-300 bg-amber-50' : ''}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-600">{sub}</div> : null}
    </Card>
  );
}

function formatTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
