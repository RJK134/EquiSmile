'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { DeleteEntityButton } from '@/components/ui/DeleteEntityButton';
import { Link } from '@/i18n/navigation';

interface HorseDetail {
  id: string;
  horseName: string;
  age: number | null;
  notes: string | null;
  dentalDueDate: string | null;
  active: boolean;
  customer: { id: string; fullName: string };
  primaryYard: { id: string; yardName: string; postcode: string } | null;
}

export default function HorseDetailPage() {
  const t = useTranslations('horses');
  const tc = useTranslations('common');
  const format = useFormatter();
  const params = useParams();
  const id = params.id as string;
  const [horse, setHorse] = useState<HorseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/horses/${id}`)
      .then(r => { if (r.ok) return r.json(); return null; })
      .then(data => { if (!cancelled) { if (data) setHorse(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id, refreshKey]);

  const toggleActive = async () => {
    if (!horse) return;
    await fetch(`/api/horses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !horse.active }),
    });
    setRefreshKey(k => k + 1);
  };

  if (loading) return <div className="flex h-full flex-col"><Header /><div className="flex flex-1 overflow-hidden"><Sidebar /><main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6"><LoadingState /></main></div><MobileNav /></div>;
  if (!horse) return <div className="flex h-full flex-col"><Header /><div className="flex flex-1 overflow-hidden"><Sidebar /><main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6"><p className="text-muted">{tc('noResults')}</p></main></div><MobileNav /></div>;

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <div className="mb-4"><Link href="/horses" className="text-sm text-primary hover:underline">&larr; {tc('back')}</Link></div>
          <PageHeader
            title={horse.horseName}
            subtitle={`${t('customer')}: ${horse.customer.fullName}`}
            action={
              <div className="flex gap-2">
                <Button onClick={toggleActive} size="sm" variant={horse.active ? 'danger' : 'primary'}>
                  {horse.active ? t('inactive') : t('active')}
                </Button>
                <DeleteEntityButton
                  endpoint={`/api/horses/${horse.id}`}
                  entityLabel={horse.horseName}
                  entityKind="horse"
                  afterDeletePath="/horses"
                  requiredRole="vet"
                />
              </div>
            }
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-medium text-muted">{tc('details')}</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted">{t('age')}</dt><dd>{horse.age ?? '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">{t('dentalDue')}</dt><dd>{horse.dentalDueDate ? format.dateTime(new Date(horse.dentalDueDate), { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">{t('active')}</dt><dd className={horse.active ? 'text-green-600' : 'text-muted'}>{horse.active ? t('active') : t('inactive')}</dd></div>
                {horse.notes && <div><dt className="text-muted">{t('form.notes')}</dt><dd className="mt-1">{horse.notes}</dd></div>}
              </dl>
            </Card>
            <Card>
              <h3 className="mb-3 text-sm font-medium text-muted">{t('yard')}</h3>
              {horse.primaryYard ? (
                <Link href={`/yards/${horse.primaryYard.id}`} className="text-primary hover:underline">
                  {horse.primaryYard.yardName} ({horse.primaryYard.postcode})
                </Link>
              ) : <p className="text-sm text-muted">—</p>}
              <h3 className="mb-3 mt-6 text-sm font-medium text-muted">{t('customer')}</h3>
              <Link href={`/customers/${horse.customer.id}`} className="text-primary hover:underline">{horse.customer.fullName}</Link>
            </Card>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
