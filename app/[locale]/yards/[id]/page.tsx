'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { FormField, inputStyles } from '@/components/ui/FormField';
import { DeleteEntityButton } from '@/components/ui/DeleteEntityButton';
import { Link } from '@/i18n/navigation';

interface YardDetail {
  id: string;
  yardName: string;
  addressLine1: string;
  addressLine2: string | null;
  town: string;
  county: string | null;
  postcode: string;
  accessNotes: string | null;
  areaLabel: string | null;
  customer: { id: string; fullName: string };
  horses: Array<{ id: string; horseName: string; age: number | null; active: boolean }>;
}

export default function YardDetailPage() {
  const t = useTranslations('yards');
  const tc = useTranslations('common');
  const params = useParams();
  const id = params.id as string;
  const [yard, setYard] = useState<YardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/yards/${id}`)
      .then(r => { if (r.ok) return r.json(); return null; })
      .then(data => { if (!cancelled) { if (data) setYard(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id, refreshKey]);

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await fetch(`/api/yards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yardName: form.get('yardName'),
        addressLine1: form.get('addressLine1'),
        addressLine2: form.get('addressLine2') || null,
        town: form.get('town'),
        county: form.get('county') || null,
        postcode: form.get('postcode'),
        accessNotes: form.get('accessNotes') || null,
        areaLabel: form.get('areaLabel') || null,
      }),
    });
    setEditing(false);
    setRefreshKey(k => k + 1);
  };

  if (loading) return <div className="flex h-full flex-col"><Header /><div className="flex flex-1 overflow-hidden"><Sidebar /><main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6"><LoadingState /></main></div><MobileNav /></div>;
  if (!yard) return <div className="flex h-full flex-col"><Header /><div className="flex flex-1 overflow-hidden"><Sidebar /><main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6"><p className="text-muted">{tc('noResults')}</p></main></div><MobileNav /></div>;

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <div className="mb-4">
            <Link href="/yards" className="text-sm text-primary hover:underline">&larr; {tc('back')}</Link>
          </div>
          <PageHeader
            title={yard.yardName}
            subtitle={t('form.editTitle')}
            action={
              <div className="flex gap-2">
                <Button onClick={() => setEditing(true)} size="sm" variant="secondary">{tc('edit')}</Button>
                <DeleteEntityButton
                  endpoint={`/api/yards/${yard.id}`}
                  entityLabel={yard.yardName}
                  entityKind="yard"
                  afterDeletePath="/yards"
                />
              </div>
            }
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-medium text-muted">{tc('details')}</h3>
              <dl className="space-y-2 text-sm">
                <div><dt className="text-muted">{t('address')}</dt><dd>{yard.addressLine1}{yard.addressLine2 ? `, ${yard.addressLine2}` : ''}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">{t('form.town')}</dt><dd>{yard.town}</dd></div>
                {yard.county && <div className="flex justify-between"><dt className="text-muted">{t('form.county')}</dt><dd>{yard.county}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted">{t('postcode')}</dt><dd>{yard.postcode}</dd></div>
                {yard.areaLabel && <div className="flex justify-between"><dt className="text-muted">{t('area')}</dt><dd>{yard.areaLabel}</dd></div>}
                {yard.accessNotes && <div><dt className="text-muted">{t('accessNotes')}</dt><dd className="mt-1">{yard.accessNotes}</dd></div>}
              </dl>
            </Card>
            <Card>
              <h3 className="mb-3 text-sm font-medium text-muted">{t('linkedCustomer')}</h3>
              <Link href={`/customers/${yard.customer.id}`} className="text-primary hover:underline">{yard.customer.fullName}</Link>
            </Card>
          </div>

          <Card className="mt-4">
            <h3 className="mb-3 text-sm font-medium text-muted">{t('horsesAtYard')}</h3>
            {yard.horses.length === 0 ? <p className="text-sm text-muted">—</p> : (
              <div className="space-y-2">
                {yard.horses.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <Link href={`/horses/${h.id}`} className="font-medium text-primary hover:underline">{h.horseName}</Link>
                    <span className={`text-xs ${h.active ? 'text-green-600' : 'text-muted'}`}>{h.active ? '● Active' : '○ Inactive'}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Modal open={editing} onClose={() => setEditing(false)} title={t('form.editTitle')}>
            <form onSubmit={handleEdit} className="space-y-4">
              <FormField label={t('form.yardName')} required><input name="yardName" required className={inputStyles} defaultValue={yard.yardName} /></FormField>
              <FormField label={t('form.addressLine1')} required><input name="addressLine1" required className={inputStyles} defaultValue={yard.addressLine1} /></FormField>
              <FormField label={t('form.addressLine2')}><input name="addressLine2" className={inputStyles} defaultValue={yard.addressLine2 || ''} /></FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t('form.town')} required><input name="town" required className={inputStyles} defaultValue={yard.town} /></FormField>
                <FormField label={t('form.county')}><input name="county" className={inputStyles} defaultValue={yard.county || ''} /></FormField>
              </div>
              <FormField label={t('form.postcode')} required><input name="postcode" required className={inputStyles} defaultValue={yard.postcode} /></FormField>
              <FormField label={t('form.accessNotes')}><textarea name="accessNotes" rows={2} className={inputStyles} defaultValue={yard.accessNotes || ''} /></FormField>
              <FormField label={t('form.areaLabel')}><input name="areaLabel" className={inputStyles} defaultValue={yard.areaLabel || ''} /></FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>{tc('cancel')}</Button>
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
