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
import { Modal } from '@/components/ui/Modal';
import { FormField, inputStyles, selectStyles } from '@/components/ui/FormField';
import { Link } from '@/i18n/navigation';

interface Horse {
  id: string;
  horseName: string;
  age: number | null;
  active: boolean;
  dentalDueDate: string | null;
  customer: { id: string; fullName: string };
  primaryYard: { id: string; yardName: string } | null;
}

interface CustomerOption { id: string; fullName: string; }
interface YardOption { id: string; yardName: string; }

export default function HorsesPage() {
  const t = useTranslations('horses');
  const tc = useTranslations('common');
  const format = useFormatter();
  const [horses, setHorses] = useState<{ data: Horse[]; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [yards, setYards] = useState<YardOption[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (search) params.set('search', search);
    if (activeFilter) params.set('active', activeFilter);
    fetch(`/api/horses?${params}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setHorses(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [page, search, activeFilter, refreshKey]);

  const openCreateModal = async () => {
    const [cRes, yRes] = await Promise.all([
      fetch('/api/customers?pageSize=100'),
      fetch('/api/yards?pageSize=100'),
    ]);
    const cData = await cRes.json();
    const yData = await yRes.json();
    setCustomers(cData.data || []);
    setYards(yData.data || []);
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const ageVal = form.get('age');
    await fetch('/api/horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: form.get('customerId'),
        primaryYardId: form.get('primaryYardId') || null,
        horseName: form.get('horseName'),
        age: ageVal ? Number(ageVal) : null,
        notes: form.get('notes') || null,
        dentalDueDate: form.get('dentalDueDate') || null,
        active: true,
      }),
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
          <PageHeader title={t('title')} subtitle={t('subtitle')} action={<Button onClick={openCreateModal} size="sm">{t('newHorse')}</Button>} />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <input type="text" placeholder={tc('search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={`${inputStyles} sm:max-w-xs`} />
            <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }} className={`${selectStyles} sm:max-w-[200px]`}>
              <option value="">{tc('all')}</option>
              <option value="true">{t('active')}</option>
              <option value="false">{t('inactive')}</option>
            </select>
          </div>

          {loading ? <LoadingState /> : !horses || horses.data.length === 0 ? (
            <EmptyState message={t('empty')} action={<Button onClick={openCreateModal} size="sm">{t('newHorse')}</Button>} />
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {horses.data.map((h) => (
                  <Link key={h.id} href={`/horses/${h.id}`}>
                    <Card padding="sm" className="hover:border-primary/30">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{h.horseName}</p>
                          <p className="text-xs text-muted">{h.customer.fullName}{h.primaryYard ? ` @ ${h.primaryYard.yardName}` : ''}</p>
                        </div>
                        <span className={`text-xs ${h.active ? 'text-green-600' : 'text-muted'}`}>{h.active ? t('active') : t('inactive')}</span>
                      </div>
                      {h.age && <p className="mt-1 text-xs text-muted">{h.age} yrs</p>}
                      {h.dentalDueDate && <p className="text-xs text-muted">{t('dentalDue')}: {format.dateTime(new Date(h.dentalDueDate), { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
                    </Card>
                  </Link>
                ))}
              </div>

              <div className="hidden lg:block">
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface text-left text-xs font-medium text-muted">
                      <tr>
                        <th className="px-4 py-3">{t('horseName')}</th>
                        <th className="px-4 py-3">{t('age')}</th>
                        <th className="px-4 py-3">{t('customer')}</th>
                        <th className="px-4 py-3">{t('yard')}</th>
                        <th className="px-4 py-3">{t('dentalDue')}</th>
                        <th className="px-4 py-3">{t('active')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {horses.data.map((h) => (
                        <tr key={h.id} className="hover:bg-surface/50">
                          <td className="px-4 py-3"><Link href={`/horses/${h.id}`} className="font-medium text-primary hover:underline">{h.horseName}</Link></td>
                          <td className="px-4 py-3 text-muted">{h.age ?? '—'}</td>
                          <td className="px-4 py-3"><Link href={`/customers/${h.customer.id}`} className="text-primary hover:underline">{h.customer.fullName}</Link></td>
                          <td className="px-4 py-3 text-muted">{h.primaryYard?.yardName || '—'}</td>
                          <td className="px-4 py-3 text-muted">{h.dentalDueDate ? format.dateTime(new Date(h.dentalDueDate), { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                          <td className="px-4 py-3"><span className={h.active ? 'text-green-600' : 'text-muted'}>{h.active ? '●' : '○'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {horses.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>{tc('previous')}</Button>
                  <span className="text-sm text-muted">{page} / {horses.totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={page === horses.totalPages} onClick={() => setPage((p) => p + 1)}>{tc('next')}</Button>
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
              <FormField label={t('form.yard')}>
                <select name="primaryYardId" className={selectStyles}>
                  <option value="">{t('form.yard')}</option>
                  {yards.map((y) => <option key={y.id} value={y.id}>{y.yardName}</option>)}
                </select>
              </FormField>
              <FormField label={t('form.horseName')} required><input name="horseName" required className={inputStyles} /></FormField>
              <FormField label={t('form.age')}><input name="age" type="number" min="0" max="50" className={inputStyles} /></FormField>
              <FormField label={t('form.notes')}><textarea name="notes" rows={2} className={inputStyles} /></FormField>
              <FormField label={t('form.dentalDueDate')}><input name="dentalDueDate" type="date" className={inputStyles} /></FormField>
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
