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
import { Modal } from '@/components/ui/Modal';
import { FormField, inputStyles, selectStyles } from '@/components/ui/FormField';
import { Link } from '@/i18n/navigation';

interface Customer {
  id: string;
  fullName: string;
  mobilePhone: string | null;
  email: string | null;
  preferredChannel: string;
  preferredLanguage: string;
  notes: string | null;
  _count: { yards: number; horses: number; enquiries: number };
}

interface PaginatedCustomers {
  data: Customer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function CustomersPage() {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const [customers, setCustomers] = useState<PaginatedCustomers | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (search) params.set('search', search);
    if (channelFilter) params.set('preferredChannel', channelFilter);
    fetch(`/api/customers?${params}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setCustomers(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [page, search, channelFilter, refreshKey]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      fullName: form.get('fullName'),
      mobilePhone: form.get('mobilePhone') || null,
      email: form.get('email') || null,
      preferredChannel: form.get('preferredChannel'),
      preferredLanguage: form.get('preferredLanguage'),
      notes: form.get('notes') || null,
    };
    await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowModal(false);
    setRefreshKey(k => k + 1);
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
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/api/export/vetup?profile=patient"
                  className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-surface"
                  download
                  title={t('exportVetupHelp')}
                >
                  {t('exportVetup')}
                </a>
                <a
                  href="/api/export/vetup?profile=customers"
                  className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-surface"
                  download
                >
                  {t('exportCustomers')}
                </a>
                <a
                  href="/api/export/vetup?profile=yards"
                  className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-surface"
                  download
                >
                  {t('exportYards')}
                </a>
                <Button onClick={() => setShowModal(true)} size="sm">
                  {t('newCustomer')}
                </Button>
              </div>
            }
          />

          {/* Search and Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder={tc('search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={`${inputStyles} sm:max-w-xs`}
            />
            <select
              value={channelFilter}
              onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
              className={`${selectStyles} sm:max-w-[200px]`}
            >
              <option value="">{tc('all')}</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
              <option value="PHONE">Phone</option>
            </select>
          </div>

          {loading ? (
            <LoadingState />
          ) : !customers || customers.data.length === 0 ? (
            <EmptyState
              message={t('empty')}
              action={
                <Button onClick={() => setShowModal(true)} size="sm">
                  {t('newCustomer')}
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile: card view */}
              <div className="space-y-3 lg:hidden">
                {customers.data.map((c) => (
                  <Link key={c.id} href={`/customers/${c.id}`}>
                    <Card padding="sm" className="hover:border-primary/30">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{c.fullName}</p>
                          <p className="text-xs text-muted">{c.mobilePhone || c.email || '—'}</p>
                        </div>
                        <StatusBadge type="channel" value={c.preferredChannel} />
                      </div>
                      <div className="mt-2 flex gap-3 text-xs text-muted">
                        <span>{c._count.yards} {t('yards')}</span>
                        <span>{c._count.horses} {t('horses')}</span>
                        <span>{c._count.enquiries} {t('enquiriesCount')}</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-xs">{c.preferredLanguage === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Desktop: table view */}
              <div className="hidden lg:block">
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface text-left text-xs font-medium text-muted">
                      <tr>
                        <th className="px-4 py-3">{t('fullName')}</th>
                        <th className="px-4 py-3">{t('phone')}</th>
                        <th className="px-4 py-3">{t('email')}</th>
                        <th className="px-4 py-3">{t('preferredChannel')}</th>
                        <th className="px-4 py-3">{t('preferredLanguage')}</th>
                        <th className="px-4 py-3">{t('yards')}</th>
                        <th className="px-4 py-3">{t('horses')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {customers.data.map((c) => (
                        <tr key={c.id} className="hover:bg-surface/50">
                          <td className="px-4 py-3">
                            <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                              {c.fullName}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted">{c.mobilePhone || '—'}</td>
                          <td className="px-4 py-3 text-muted">{c.email || '—'}</td>
                          <td className="px-4 py-3"><StatusBadge type="channel" value={c.preferredChannel} /></td>
                          <td className="px-4 py-3">{c.preferredLanguage === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}</td>
                          <td className="px-4 py-3 text-muted">{c._count.yards}</td>
                          <td className="px-4 py-3 text-muted">{c._count.horses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {customers.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    {tc('previous')}
                  </Button>
                  <span className="text-sm text-muted">{page} / {customers.totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={page === customers.totalPages} onClick={() => setPage((p) => p + 1)}>
                    {tc('next')}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Create Customer Modal */}
          <Modal open={showModal} onClose={() => setShowModal(false)} title={t('form.title')}>
            <form onSubmit={handleCreate} className="space-y-4">
              <FormField label={t('form.fullName')} required>
                <input name="fullName" required className={inputStyles} />
              </FormField>
              <FormField label={t('form.phone')}>
                <input name="mobilePhone" type="tel" className={inputStyles} />
              </FormField>
              <FormField label={t('form.email')}>
                <input name="email" type="email" className={inputStyles} />
              </FormField>
              <FormField label={t('form.preferredChannel')}>
                <select name="preferredChannel" className={selectStyles} defaultValue="WHATSAPP">
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone</option>
                </select>
              </FormField>
              <FormField label={t('form.preferredLanguage')}>
                <select name="preferredLanguage" className={selectStyles} defaultValue="en">
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </FormField>
              <FormField label={t('form.notes')}>
                <textarea name="notes" rows={3} className={inputStyles} />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  {tc('cancel')}
                </Button>
                <Button type="submit">{tc('save')}</Button>
              </div>
            </form>
          </Modal>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
