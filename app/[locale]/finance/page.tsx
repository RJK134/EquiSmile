'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Link } from '@/i18n/navigation';
import { InvoiceStatusPill } from '@/components/finance/InvoiceStatusPill';
import type { FinanceInvoiceStatus } from '@prisma/client';

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  customerId: string;
  issuedAt: string;
  dueAt: string;
  total: string;
  currency: string;
  status: FinanceInvoiceStatus;
  qrReference: string | null;
}

interface InvoiceList {
  data: InvoiceRow[];
  total: number;
  limit: number;
  offset: number;
}

function thisYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function FinancePage() {
  const t = useTranslations('finance');
  const tc = useTranslations('common');
  const format = useFormatter();
  const [data, setData] = useState<InvoiceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FinanceInvoiceStatus | 'ALL'>('ALL');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '50' });
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    fetch(`/api/finance/invoices?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: InvoiceList | null) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const ym = thisYearMonth();

  // Aggregate counters from the loaded list. These are page-local
  // (limit:50) — a real "total outstanding" should come from a
  // dedicated endpoint, but the list snapshot is fine for the demo.
  const totals = (() => {
    const init = { open: 0, partial: 0, overdue: 0, paid: 0, sumOpen: 0, sumPaid: 0 };
    if (!data) return init;
    return data.data.reduce((acc, inv) => {
      const t = parseFloat(inv.total);
      if (inv.status === 'OPEN') {
        acc.open++;
        acc.sumOpen += t;
      } else if (inv.status === 'PARTIAL') {
        acc.partial++;
        acc.sumOpen += t;
      } else if (inv.status === 'OVERDUE') {
        acc.overdue++;
        acc.sumOpen += t;
      } else if (inv.status === 'PAID') {
        acc.paid++;
        acc.sumPaid += t;
      }
      return acc;
    }, init);
  })();

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
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/finance/exports/${ym}`}
                  className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  {t('downloadMonthlyExport', { ym })}
                </a>
              </div>
            }
          />

          {/* Counters */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card padding="sm">
              <p className="text-xs text-muted">{t('open')}</p>
              <p className="mt-1 text-2xl font-bold">{totals.open + totals.partial}</p>
              <p className="text-xs text-muted">CHF {totals.sumOpen.toFixed(2)}</p>
            </Card>
            <Card padding="sm" className={totals.overdue > 0 ? 'border-danger/30 bg-red-50/50' : ''}>
              <p className="text-xs text-muted">{t('overdue')}</p>
              <p className={`mt-1 text-2xl font-bold ${totals.overdue > 0 ? 'text-danger' : ''}`}>
                {totals.overdue}
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-muted">{t('paid')}</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{totals.paid}</p>
              <p className="text-xs text-muted">CHF {totals.sumPaid.toFixed(2)}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-muted">{t('totalShown')}</p>
              <p className="mt-1 text-2xl font-bold">{data?.data.length ?? 0}</p>
              <p className="text-xs text-muted">{t('ofTotal', { count: data?.total ?? 0 })}</p>
            </Card>
          </div>

          {/* Status filter */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label htmlFor="finance-status-filter" className="text-xs text-muted">
              {t('filterByStatus')}:
            </label>
            <select
              id="finance-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FinanceInvoiceStatus | 'ALL')}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="ALL">{tc('all')}</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Invoice list */}
          {loading ? (
            <LoadingState />
          ) : !data || data.data.length === 0 ? (
            <EmptyState message={t('empty')} />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="pb-2 pr-3">{t('columnInvoice')}</th>
                      <th className="pb-2 pr-3">{t('columnIssued')}</th>
                      <th className="pb-2 pr-3">{t('columnDue')}</th>
                      <th className="pb-2 pr-3">{t('columnTotal')}</th>
                      <th className="pb-2 pr-3">{t('columnStatus')}</th>
                      <th className="pb-2">{t('columnActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((inv) => (
                      <tr key={inv.id} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-medium">
                          <Link
                            href={`/customers/${inv.customerId}`}
                            className="text-primary hover:underline"
                          >
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {format.dateTime(new Date(inv.issuedAt), {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-2 pr-3">
                          {format.dateTime(new Date(inv.dueAt), {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-2 pr-3 font-mono">
                          {inv.currency} {parseFloat(inv.total).toFixed(2)}
                        </td>
                        <td className="py-2 pr-3">
                          <InvoiceStatusPill status={inv.status} />
                        </td>
                        <td className="py-2">
                          <a
                            href={`/api/invoices/${inv.id}/qr-bill.pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            {t('downloadQrBill')}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <p className="mt-6 text-xs text-muted">
            {t('importHint')}{' '}
            <Link href="/finance/import" className="text-primary hover:underline">
              {t('goToImport')}
            </Link>
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                fetch(`/api/finance/exports/${ym}`, { method: 'POST' });
              }}
            >
              {t('emailMonthlyExport')}
            </Button>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
