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
import { Modal } from '@/components/ui/Modal';
import { FormField, inputStyles, selectStyles } from '@/components/ui/FormField';
import { Link } from '@/i18n/navigation';

interface Yard {
  id: string;
  yardName: string;
  addressLine1: string;
  town: string;
  postcode: string;
  areaLabel: string | null;
  customer: { id: string; fullName: string };
  _count: { horses: number };
}

interface CustomerOption {
  id: string;
  fullName: string;
}

export default function YardsPage() {
  const t = useTranslations('yards');
  const tc = useTranslations('common');
  const [yards, setYards] = useState<{ data: Yard[]; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (search) params.set('search', search);
    fetch(`/api/yards?${params}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setYards(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [page, search, refreshKey]);

  const fetchCustomers = async () => {
    const res = await fetch('/api/customers?pageSize=100');
    const data = await res.json();
    setCustomers(data.data || []);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      customerId: form.get('customerId'),
      yardName: form.get('yardName'),
      addressLine1: form.get('addressLine1'),
      addressLine2: form.get('addressLine2') || null,
      town: form.get('town'),
      county: form.get('county') || null,
      postcode: form.get('postcode'),
      accessNotes: form.get('accessNotes') || null,
      areaLabel: form.get('areaLabel') || null,
    };
    await fetch('/api/yards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowModal(false);
    setRefreshKey(k => k + 1);
  };

  const openCreateModal = () => {
    fetchCustomers();
    setShowModal(true);
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
            action={<Button onClick={openCreateModal} size="sm">{t('newYard')}</Button>}
          />

          <div className="mb-4">
            <input
              type="text"
              placeholder={tc('search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={`${inputStyles} sm:max-w-xs`}
            />
          </div>

          {loading ? (
            <LoadingState />
          ) : !yards || yards.data.length === 0 ? (
            <EmptyState message={t('empty')} action={<Button onClick={openCreateModal} size="sm">{t('newYard')}</Button>} />
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {yards.data.map((y) => (
                  <Link key={y.id} href={`/yards/${y.id}`}>
                    <Card padding="sm" className="hover:border-primary/30">
                      <p className="font-medium">{y.yardName}</p>
                      <p className="text-xs text-muted">{y.addressLine1}, {y.town} {y.postcode}</p>
                      <div className="mt-1 flex justify-between text-xs text-muted">
                        <span>{y.customer.fullName}</span>
                        <span>{y._count.horses} {t('horsesAtYard')}</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>

              <div className="hidden lg:block">
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface text-left text-xs font-medium text-muted">
                      <tr>
                        <th className="px-4 py-3">{t('yardName')}</th>
                        <th className="px-4 py-3">{t('address')}</th>
                        <th className="px-4 py-3">{t('postcode')}</th>
                        <th className="px-4 py-3">{t('area')}</th>
                        <th className="px-4 py-3">{t('linkedCustomer')}</th>
                        <th className="px-4 py-3">{t('horsesAtYard')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {yards.data.map((y) => (
                        <tr key={y.id} className="hover:bg-surface/50">
                          <td className="px-4 py-3">
                            <Link href={`/yards/${y.id}`} className="font-medium text-primary hover:underline">{y.yardName}</Link>
                          </td>
                          <td className="px-4 py-3 text-muted">{y.addressLine1}, {y.town}</td>
                          <td className="px-4 py-3 text-muted">{y.postcode}</td>
                          <td className="px-4 py-3 text-muted">{y.areaLabel || '—'}</td>
                          <td className="px-4 py-3">
                            <Link href={`/customers/${y.customer.id}`} className="text-primary hover:underline">{y.customer.fullName}</Link>
                          </td>
                          <td className="px-4 py-3 text-muted">{y._count.horses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {yards.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{tc('previous')}</Button>
                  <span className="text-sm text-muted">{page} / {yards.totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={page === yards.totalPages} onClick={() => setPage((p) => p + 1)}>{tc('next')}</Button>
                </div>
              )}
            </>
          )}

          <Modal open={showModal} onClose={() => setShowModal(false)} title={t('form.title')}>
            <form onSubmit={handleCreate} className="space-y-4">
              <FormField label={t('form.customer')} required>
                <select name="customerId" required className={selectStyles}>
                  <option value="">{t('form.customer')}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select>
              </FormField>
              <FormField label={t('form.yardName')} required>
                <input name="yardName" required className={inputStyles} />
              </FormField>
              <FormField label={t('form.addressLine1')} required>
                <input name="addressLine1" required className={inputStyles} />
              </FormField>
              <FormField label={t('form.addressLine2')}>
                <input name="addressLine2" className={inputStyles} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t('form.town')} required>
                  <input name="town" required className={inputStyles} />
                </FormField>
                <FormField label={t('form.county')}>
                  <input name="county" className={inputStyles} />
                </FormField>
              </div>
              <FormField label={t('form.postcode')} required>
                <input name="postcode" required className={inputStyles} />
              </FormField>
              <FormField label={t('form.accessNotes')}>
                <textarea name="accessNotes" rows={2} className={inputStyles} />
              </FormField>
              <FormField label={t('form.areaLabel')}>
                <input name="areaLabel" className={inputStyles} />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>{tc('cancel')}</Button>
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
