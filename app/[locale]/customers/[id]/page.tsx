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
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { FormField, inputStyles, selectStyles } from '@/components/ui/FormField';
import { DeleteEntityButton } from '@/components/ui/DeleteEntityButton';
import { Link } from '@/i18n/navigation';

interface CustomerDetail {
  id: string;
  fullName: string;
  mobilePhone: string | null;
  email: string | null;
  preferredChannel: string;
  preferredLanguage: string;
  notes: string | null;
  createdAt: string;
  yards: Array<{ id: string; yardName: string; postcode: string; town: string }>;
  horses: Array<{ id: string; horseName: string; age: number | null; active: boolean; primaryYard: { id: string; yardName: string } | null }>;
  enquiries: Array<{ id: string; channel: string; triageStatus: string; rawText: string; receivedAt: string }>;
}

export default function CustomerDetailPage() {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const format = useFormatter();
  const params = useParams();
  const id = params.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/customers/${id}`)
      .then(r => { if (r.ok) return r.json(); return null; })
      .then(data => { if (!cancelled) { if (data) setCustomer(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id, refreshKey]);

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
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
    await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setEditing(false);
    setRefreshKey(k => k + 1);
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
            <LoadingState />
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
            <p className="text-muted">{tc('noResults')}</p>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <div className="mb-4">
            <Link href="/customers" className="text-sm text-primary hover:underline">&larr; {tc('back')}</Link>
          </div>

          <PageHeader
            title={customer.fullName}
            subtitle={t('detail.title')}
            action={
              <div className="flex gap-2">
                <Button onClick={() => setEditing(true)} size="sm" variant="secondary">
                  {t('detail.editCustomer')}
                </Button>
                <DeleteEntityButton
                  endpoint={`/api/customers/${customer.id}`}
                  entityLabel={customer.fullName}
                  entityKind="customer"
                  afterDeletePath="/customers"
                />
              </div>
            }
          />

          {/* Customer Info */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-medium text-muted">{tc('details')}</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">{t('phone')}</dt>
                  <dd>{customer.mobilePhone || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t('email')}</dt>
                  <dd>{customer.email || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t('preferredChannel')}</dt>
                  <dd><StatusBadge type="channel" value={customer.preferredChannel} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t('preferredLanguage')}</dt>
                  <dd>{customer.preferredLanguage === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}</dd>
                </div>
                {customer.notes && (
                  <div>
                    <dt className="text-muted">{t('notes')}</dt>
                    <dd className="mt-1">{customer.notes}</dd>
                  </div>
                )}
              </dl>
            </Card>

            {/* Related Yards */}
            <Card>
              <h3 className="mb-3 text-sm font-medium text-muted">{t('detail.relatedYards')}</h3>
              {customer.yards.length === 0 ? (
                <p className="text-sm text-muted">—</p>
              ) : (
                <ul className="space-y-2">
                  {customer.yards.map((y) => (
                    <li key={y.id}>
                      <Link href={`/yards/${y.id}`} className="text-sm text-primary hover:underline">
                        {y.yardName}
                      </Link>
                      <span className="ml-2 text-xs text-muted">{y.postcode}, {y.town}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Related Horses */}
          <Card className="mt-4">
            <h3 className="mb-3 text-sm font-medium text-muted">{t('detail.relatedHorses')}</h3>
            {customer.horses.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <div className="space-y-2">
                {customer.horses.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <div>
                      <Link href={`/horses/${h.id}`} className="font-medium text-primary hover:underline">{h.horseName}</Link>
                      {h.age && <span className="ml-2 text-muted">{h.age} yrs</span>}
                      {h.primaryYard && <span className="ml-2 text-xs text-muted">@ {h.primaryYard.yardName}</span>}
                    </div>
                    <span className={`text-xs ${h.active ? 'text-green-600' : 'text-muted'}`}>
                      {h.active ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Related Enquiries */}
          <Card className="mt-4">
            <h3 className="mb-3 text-sm font-medium text-muted">{t('detail.relatedEnquiries')}</h3>
            {customer.enquiries.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <div className="space-y-2">
                {customer.enquiries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    <div>
                      <Link href={`/enquiries/${e.id}`} className="text-primary hover:underline">
                        {e.rawText.slice(0, 60)}{e.rawText.length > 60 ? '…' : ''}
                      </Link>
                      <p className="text-xs text-muted">{format.dateTime(new Date(e.receivedAt), { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge type="channel" value={e.channel} />
                      <StatusBadge type="triage" value={e.triageStatus} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Edit Customer Modal */}
          <Modal open={editing} onClose={() => setEditing(false)} title={t('form.editTitle')}>
            <form onSubmit={handleEdit} className="space-y-4">
              <FormField label={t('form.fullName')} required>
                <input name="fullName" required className={inputStyles} defaultValue={customer.fullName} />
              </FormField>
              <FormField label={t('form.phone')}>
                <input name="mobilePhone" type="tel" className={inputStyles} defaultValue={customer.mobilePhone || ''} />
              </FormField>
              <FormField label={t('form.email')}>
                <input name="email" type="email" className={inputStyles} defaultValue={customer.email || ''} />
              </FormField>
              <FormField label={t('form.preferredChannel')}>
                <select name="preferredChannel" className={selectStyles} defaultValue={customer.preferredChannel}>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="PHONE">Phone</option>
                </select>
              </FormField>
              <FormField label={t('form.preferredLanguage')}>
                <select name="preferredLanguage" className={selectStyles} defaultValue={customer.preferredLanguage}>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </FormField>
              <FormField label={t('form.notes')}>
                <textarea name="notes" rows={3} className={inputStyles} defaultValue={customer.notes || ''} />
              </FormField>
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
