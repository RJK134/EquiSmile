'use client';

import { useTranslations, useFormatter } from 'next-intl';
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
import { selectStyles } from '@/components/ui/FormField';

interface Enquiry {
  id: string;
  channel: string;
  triageStatus: string;
  rawText: string;
  receivedAt: string;
  subject: string | null;
  customer: { id: string; fullName: string } | null;
  yard: { id: string; yardName: string; postcode: string } | null;
  _count: { visitRequests: number };
}

export default function EnquiriesPage() {
  const t = useTranslations('enquiries');
  const tc = useTranslations('common');
  const format = useFormatter();
  const [enquiries, setEnquiries] = useState<{ data: Enquiry[]; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (statusFilter) params.set('triageStatus', statusFilter);
    if (channelFilter) params.set('channel', channelFilter);
    fetch(`/api/enquiries?${params}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setEnquiries(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [page, statusFilter, channelFilter]);

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <PageHeader
            title={t('title')}
            subtitle={t('subtitle')}
            action={<Link href="/enquiries/new"><Button size="sm">{t('newEnquiry')}</Button></Link>}
          />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={`${selectStyles} sm:max-w-[200px]`}>
              <option value="">{tc('all')}</option>
              <option value="NEW">{t('status.new')}</option>
              <option value="PARSED">{t('status.parsed')}</option>
              <option value="NEEDS_INFO">{t('status.needsInfo')}</option>
              <option value="TRIAGED">{t('status.triaged')}</option>
            </select>
            <select value={channelFilter} onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }} className={`${selectStyles} sm:max-w-[200px]`}>
              <option value="">{tc('all')}</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>

          {loading ? <LoadingState /> : !enquiries || enquiries.data.length === 0 ? (
            <EmptyState message={t('empty')} action={<Link href="/enquiries/new"><Button size="sm">{t('newEnquiry')}</Button></Link>} />
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {enquiries.data.map((e) => (
                  <Link key={e.id} href={`/enquiries/${e.id}`}>
                    <Card padding="sm" className="hover:border-primary/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{e.subject || e.rawText.slice(0, 50)}</p>
                          <p className="text-xs text-muted">{e.customer?.fullName || e.channel}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <StatusBadge type="triage" value={e.triageStatus} />
                          <StatusBadge type="channel" value={e.channel} />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted">{format.dateTime(new Date(e.receivedAt), { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </Card>
                  </Link>
                ))}
              </div>

              <div className="hidden lg:block">
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface text-left text-xs font-medium text-muted">
                      <tr>
                        <th className="px-4 py-3">{t('detail.rawMessage')}</th>
                        <th className="px-4 py-3">{t('customer')}</th>
                        <th className="px-4 py-3">{t('channel')}</th>
                        <th className="px-4 py-3">{t('detail.triageStatus')}</th>
                        <th className="px-4 py-3">{t('received')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {enquiries.data.map((e) => (
                        <tr key={e.id} className="hover:bg-surface/50">
                          <td className="max-w-md px-4 py-3">
                            <Link href={`/enquiries/${e.id}`} className="font-medium text-primary hover:underline">
                              {e.subject || e.rawText.slice(0, 60)}{e.rawText.length > 60 ? '…' : ''}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{e.customer ? <Link href={`/customers/${e.customer.id}`} className="text-primary hover:underline">{e.customer.fullName}</Link> : '—'}</td>
                          <td className="px-4 py-3"><StatusBadge type="channel" value={e.channel} /></td>
                          <td className="px-4 py-3"><StatusBadge type="triage" value={e.triageStatus} /></td>
                          <td className="px-4 py-3 text-muted">{format.dateTime(new Date(e.receivedAt), { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {enquiries.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{tc('previous')}</Button>
                  <span className="text-sm text-muted">{page} / {enquiries.totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={page === enquiries.totalPages} onClick={() => setPage((p) => p + 1)}>{tc('next')}</Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
