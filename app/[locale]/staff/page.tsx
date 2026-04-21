'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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

interface Staff {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'VET' | 'ADMIN' | 'NURSE';
  colour: string | null;
  active: boolean;
  notes: string | null;
}

const ROLES: Staff['role'][] = ['VET', 'ADMIN', 'NURSE'];

export default function StaffPage() {
  const { data: session, status } = useSession();
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (status !== 'authenticated' || session?.user?.role !== 'admin') {
      return;
    }
    let cancelled = false;
    fetch('/api/staff')
      .then((r) => r.json())
      .then((data: Staff[]) => {
        if (!cancelled) {
          setStaff(data);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, session?.user?.role, status]);

  if (status === 'authenticated' && session?.user?.role !== 'admin') {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto pb-16 lg:pb-4">
            <div className="mx-auto max-w-3xl p-4 lg:p-6">
              <Card>
                <h1 className="text-lg font-semibold text-danger">Access denied</h1>
                <p className="mt-2 text-sm text-muted">Only administrators can manage staff records.</p>
              </Card>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get('name'),
      email: form.get('email') || null,
      phone: form.get('phone') || null,
      role: form.get('role'),
      colour: form.get('colour') || null,
      notes: form.get('notes') || null,
    };
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowModal(false);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await fetch(`/api/staff/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-4">
          <div className="mx-auto max-w-5xl p-4 lg:p-6">
            <PageHeader
              title={t('title')}
              subtitle={t('subtitle')}
              action={
                <Button variant="primary" onClick={() => setShowModal(true)}>
                  {t('newStaff')}
                </Button>
              }
            />

            {loading ? (
              <LoadingState />
            ) : staff.length === 0 ? (
              <EmptyState message={t('empty')} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {staff.map((s) => (
                  <Card key={s.id} className={!s.active ? 'opacity-60' : ''}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="inline-block h-8 w-8 flex-shrink-0 rounded-full border border-gray-200"
                          style={{ backgroundColor: s.colour ?? '#d4d4d8' }}
                        />
                        <div>
                          <h3 className="font-medium text-gray-900">{s.name}</h3>
                          <p className="text-xs text-gray-500">{t(`role.${s.role.toLowerCase()}`)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s.id, !s.active)}
                        className="text-xs text-blue-700 hover:underline"
                      >
                        {s.active ? t('deactivate') : t('reactivate')}
                      </button>
                    </div>
                    <dl className="mt-3 space-y-1 text-xs text-gray-600">
                      {s.email && (
                        <div>
                          <dt className="inline font-medium">{t('email')}:</dt>{' '}
                          <dd className="inline">{s.email}</dd>
                        </div>
                      )}
                      {s.phone && (
                        <div>
                          <dt className="inline font-medium">{t('phone')}:</dt>{' '}
                          <dd className="inline">{s.phone}</dd>
                        </div>
                      )}
                      {s.notes && <p className="mt-2 text-gray-700">{s.notes}</p>}
                    </dl>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileNav />

      {showModal && (
        <Modal open={showModal} onClose={() => setShowModal(false)} title={t('form.title')}>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormField label={t('form.name')} required>
              <input name="name" type="text" required className={inputStyles} />
            </FormField>
            <FormField label={t('form.role')}>
              <select name="role" defaultValue="VET" className={selectStyles}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`role.${r.toLowerCase()}`)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={t('form.email')}>
              <input name="email" type="email" className={inputStyles} />
            </FormField>
            <FormField label={t('form.phone')}>
              <input name="phone" type="tel" className={inputStyles} />
            </FormField>
            <FormField label={t('form.colour')}>
              <input
                name="colour"
                type="text"
                pattern="^#[0-9a-fA-F]{6}$"
                placeholder="#9b214d"
                className={inputStyles}
              />
              <p className="mt-1 text-xs text-gray-500">{t('form.colourHelp')}</p>
            </FormField>
            <FormField label={t('form.notes')}>
              <textarea name="notes" rows={3} className={inputStyles} />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
                {tc('cancel')}
              </Button>
              <Button variant="primary" type="submit">
                {tc('create')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
