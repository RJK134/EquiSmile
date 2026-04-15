'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField, inputStyles, selectStyles } from '@/components/ui/FormField';
import { Link } from '@/i18n/navigation';

interface CustomerOption { id: string; fullName: string; }
interface YardOption { id: string; yardName: string; customerId: string; }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function NewEnquiryPage() {
  const t = useTranslations('enquiries');
  const tc = useTranslations('common');
  const tDays = useTranslations('days');
  const tTime = useTranslations('timeBands');
  const tReq = useTranslations('requestTypes');
  const tStatus = useTranslations('status');
  const router = useRouter();

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [yards, setYards] = useState<YardOption[]>([]);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/customers?pageSize=100').then((r) => r.json()),
      fetch('/api/yards?pageSize=100').then((r) => r.json()),
    ]).then(([cData, yData]) => {
      setCustomers(cData.data || []);
      setYards(yData.data || []);
    });
  }, []);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const horseCountVal = form.get('horseCount');

    const body = {
      customerId: isNewCustomer ? null : form.get('customerId') || null,
      newCustomerName: isNewCustomer ? form.get('newCustomerName') : undefined,
      newCustomerPhone: isNewCustomer ? form.get('newCustomerPhone') : undefined,
      newCustomerEmail: isNewCustomer ? form.get('newCustomerEmail') : undefined,
      channel: form.get('channel'),
      subject: form.get('subject') || undefined,
      rawText: form.get('rawText'),
      yardId: form.get('yardId') || null,
      horseCount: horseCountVal ? Number(horseCountVal) : null,
      requestType: form.get('requestType'),
      urgencyLevel: form.get('urgencyLevel'),
      preferredDays: selectedDays,
      preferredTimeBand: form.get('preferredTimeBand'),
      notes: form.get('notes') || undefined,
    };

    const res = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const result = await res.json();
      router.push(`/enquiries/${result.enquiry.id}`);
    } else {
      const err = await res.json();
      setError(err.error || tc('error'));
      setSubmitting(false);
    }
  };

  const dayKeys: Record<string, string> = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' };

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <div className="mb-4"><Link href="/enquiries" className="text-sm text-primary hover:underline">&larr; {tc('back')}</Link></div>
          <PageHeader title={t('form.title')} />

          {error && <div className="mb-4 rounded-md border border-danger bg-red-50 p-3 text-sm text-danger">{error}</div>}

          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Section */}
              <div>
                <div className="mb-3 flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="customerMode" checked={!isNewCustomer} onChange={() => setIsNewCustomer(false)} />
                    {t('form.selectCustomer')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="customerMode" checked={isNewCustomer} onChange={() => setIsNewCustomer(true)} />
                    {t('form.createNewCustomer')}
                  </label>
                </div>
                {!isNewCustomer ? (
                  <FormField label={t('form.selectCustomer')} required>
                    <select name="customerId" required className={selectStyles}>
                      <option value="">{t('form.selectCustomer')}</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                    </select>
                  </FormField>
                ) : (
                  <div className="space-y-3">
                    <FormField label={t('form.customerName')} required><input name="newCustomerName" required className={inputStyles} /></FormField>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label={t('form.customerPhone')}><input name="newCustomerPhone" type="tel" className={inputStyles} /></FormField>
                      <FormField label={t('form.customerEmail')}><input name="newCustomerEmail" type="email" className={inputStyles} /></FormField>
                    </div>
                  </div>
                )}
              </div>

              {/* Enquiry */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t('form.channel')} required>
                  <select name="channel" required className={selectStyles}>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </FormField>
                <FormField label={t('form.subject')}><input name="subject" className={inputStyles} /></FormField>
              </div>

              <FormField label={t('form.message')} required>
                <textarea name="rawText" required rows={4} className={inputStyles} />
              </FormField>

              {/* Yard */}
              <FormField label={t('form.selectYard')}>
                <select name="yardId" className={selectStyles}>
                  <option value="">{t('form.selectYard')}</option>
                  {yards.map((y) => <option key={y.id} value={y.id}>{y.yardName}</option>)}
                </select>
              </FormField>

              {/* Visit Request */}
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label={t('form.horseCount')}>
                  <input name="horseCount" type="number" min="1" className={inputStyles} />
                </FormField>
                <FormField label={t('form.requestType')} required>
                  <select name="requestType" required className={selectStyles}>
                    <option value="ROUTINE_DENTAL">{tReq('routineDental')}</option>
                    <option value="FOLLOW_UP">{tReq('followUp')}</option>
                    <option value="URGENT_ISSUE">{tReq('urgentIssue')}</option>
                    <option value="FIRST_VISIT">{tReq('firstVisit')}</option>
                    <option value="ADMIN">{tReq('admin')}</option>
                  </select>
                </FormField>
                <FormField label={t('form.urgencyLevel')} required>
                  <select name="urgencyLevel" required className={selectStyles}>
                    <option value="ROUTINE">{tStatus('routine')}</option>
                    <option value="SOON">{tStatus('soon')}</option>
                    <option value="URGENT">{tStatus('urgent')}</option>
                  </select>
                </FormField>
              </div>

              {/* Preferred Days */}
              <FormField label={t('form.preferredDays')}>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`min-h-[44px] min-w-[44px] rounded-md border px-3 py-2 text-sm transition-colors ${
                        selectedDays.includes(day)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted hover:bg-surface'
                      }`}
                    >
                      {tDays(dayKeys[day])}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label={t('form.preferredTime')}>
                <select name="preferredTimeBand" className={selectStyles}>
                  <option value="ANY">{tTime('any')}</option>
                  <option value="AM">{tTime('am')}</option>
                  <option value="PM">{tTime('pm')}</option>
                </select>
              </FormField>

              <FormField label={t('form.notes')}>
                <textarea name="notes" rows={2} className={inputStyles} />
              </FormField>

              <div className="flex justify-end gap-2">
                <Link href="/enquiries"><Button type="button" variant="secondary">{tc('cancel')}</Button></Link>
                <Button type="submit" disabled={submitting}>{submitting ? tc('loading') : t('form.submit')}</Button>
              </div>
            </form>
          </Card>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
