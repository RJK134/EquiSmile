'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { useState, useEffect, use } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Link } from '@/i18n/navigation';

interface AppointmentDetail {
  id: string;
  appointmentStart: string;
  appointmentEnd: string;
  status: string;
  confirmationChannel: string | null;
  confirmationSentAt: string | null;
  reminderSentAt24h: string | null;
  reminderSentAt2h: string | null;
  cancellationReason: string | null;
  createdAt: string;
  visitRequest: {
    id: string;
    horseCount: number | null;
    requestType: string;
    urgencyLevel: string;
    enquiryId: string | null;
    customer: {
      id: string;
      fullName: string;
      mobilePhone: string | null;
      email: string | null;
      preferredChannel: string;
      preferredLanguage: string;
    };
    yard: {
      id: string;
      yardName: string;
      addressLine1: string;
      town: string;
      postcode: string;
    } | null;
  };
  routeRun: {
    id: string;
    runDate: string;
    status: string;
  } | null;
  visitOutcome: {
    id: string;
    completedAt: string;
    notes: string | null;
    followUpRequired: boolean;
    followUpDueDate: string | null;
    nextDentalDueDate: string | null;
    invoiceStatus: string;
  } | null;
}

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('appointments');
  const td = useTranslations('appointments.detail');
  const tc = useTranslations('common');
  const format = useFormatter();
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);

  // Completion form state
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDueDate, setFollowUpDueDate] = useState('');
  const [nextDentalDueDate, setNextDentalDueDate] = useState('');

  useEffect(() => {
    fetch(`/api/appointments/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setAppointment(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: string, body?: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/appointments/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      if (res.ok) {
        // Refresh
        const data = await fetch(`/api/appointments/${id}`).then((r) => r.json());
        setAppointment(data);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    await handleAction('complete', {
      notes: clinicalNotes || undefined,
      followUpRequired,
      followUpDueDate: followUpDueDate || undefined,
      nextDentalDueDate: nextDentalDueDate || undefined,
    });
    setShowCompleteForm(false);
  };

  const handleCancel = async () => {
    if (!confirm(t('cancelConfirm'))) return;
    const reason = prompt(t('cancelReason'));
    await handleAction('cancel', { reason: reason ?? undefined });
  };

  const handleNoShow = async () => {
    if (!confirm(t('noShowConfirm'))) return;
    await handleAction('no-show');
  };

  const formatDate = (dateStr: string) =>
    format.dateTime(new Date(dateStr), { year: 'numeric', month: 'short', day: 'numeric' });

  const formatTime = (dateStr: string) =>
    format.dateTime(new Date(dateStr), { hour: '2-digit', minute: '2-digit' });

  const formatDateTime = (dateStr: string) =>
    format.dateTime(new Date(dateStr), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

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

  if (!appointment) {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
            <p>{tc('error')}</p>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  const isActive = appointment.status === 'PROPOSED' || appointment.status === 'CONFIRMED';

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <div className="mb-2">
            <Link href="/appointments" className="text-sm text-primary hover:underline">
              {tc('back')}
            </Link>
          </div>

          <PageHeader
            title={td('title')}
            subtitle={formatDate(appointment.appointmentStart)}
          />

          {/* Appointment Info */}
          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-semibold">{td('appointmentInfo')}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <div>
                <span className="text-xs text-muted">{t('date')}</span>
                <p className="font-medium">{formatDate(appointment.appointmentStart)}</p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('time')}</span>
                <p className="font-medium">
                  {formatTime(appointment.appointmentStart)} – {formatTime(appointment.appointmentEnd)}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('status')}</span>
                <p><StatusBadge type="appointment" value={appointment.status} /></p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('customer')}</span>
                <p className="font-medium">
                  <Link
                    href={`/customers/${appointment.visitRequest.customer.id}`}
                    className="text-primary hover:underline"
                  >
                    {appointment.visitRequest.customer.fullName}
                  </Link>
                </p>
              </div>
              <div>
                <span className="text-xs text-muted">{t('yard')}</span>
                <p className="font-medium">
                  {appointment.visitRequest.yard ? (
                    <Link
                      href={`/yards/${appointment.visitRequest.yard.id}`}
                      className="text-primary hover:underline"
                    >
                      {appointment.visitRequest.yard.yardName}
                    </Link>
                  ) : (
                    '—'
                  )}
                </p>
                {appointment.visitRequest.yard && (
                  <p className="text-xs text-muted">
                    {appointment.visitRequest.yard.addressLine1}, {appointment.visitRequest.yard.town}, {appointment.visitRequest.yard.postcode}
                  </p>
                )}
              </div>
              <div>
                <span className="text-xs text-muted">{t('horses')}</span>
                <p className="font-medium">{appointment.visitRequest.horseCount ?? '—'}</p>
              </div>
            </div>
          </Card>

          {/* Route Context */}
          {appointment.routeRun && (
            <Card className="mb-6">
              <h2 className="mb-4 text-lg font-semibold">{td('routeContext')}</h2>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs text-muted">{t('route')}</span>
                  <p>
                    <Link
                      href={`/route-runs/${appointment.routeRun.id}`}
                      className="text-primary hover:underline"
                    >
                      {formatDate(appointment.routeRun.runDate)}
                    </Link>
                  </p>
                </div>
                <StatusBadge type="planning" value={appointment.routeRun.status} />
              </div>
            </Card>
          )}

          {/* Confirmation & Reminder Status */}
          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-semibold">{td('confirmationHistory')}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>{t('confirmationStatus')}</span>
                <div className="flex items-center gap-2">
                  {appointment.confirmationChannel && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                      {t(`channel.${appointment.confirmationChannel.toLowerCase()}`)}
                    </span>
                  )}
                  {appointment.confirmationSentAt ? (
                    <span className="text-green-600">
                      {td('sentAt')} {formatDateTime(appointment.confirmationSentAt)}
                    </span>
                  ) : (
                    <span className="text-muted">{td('notSent')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('reminder24h')}</span>
                {appointment.reminderSentAt24h ? (
                  <span className="text-green-600">
                    {td('sentAt')} {formatDateTime(appointment.reminderSentAt24h)}
                  </span>
                ) : (
                  <span className="text-muted">{td('notSent')}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>{t('reminder2h')}</span>
                {appointment.reminderSentAt2h ? (
                  <span className="text-green-600">
                    {td('sentAt')} {formatDateTime(appointment.reminderSentAt2h)}
                  </span>
                ) : (
                  <span className="text-muted">{td('notSent')}</span>
                )}
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          {isActive && (
            <div className="mb-6 flex flex-wrap gap-2">
              <Button
                onClick={() => handleAction('confirm')}
                disabled={actionLoading}
              >
                {appointment.confirmationSentAt ? t('resendConfirmation') : t('sendConfirmation')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowCompleteForm(true)}
                disabled={actionLoading}
              >
                {t('markComplete')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleAction('reschedule', {})}
                disabled={actionLoading}
              >
                {t('reschedule')}
              </Button>
              <Button
                variant="danger"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="ghost"
                onClick={handleNoShow}
                disabled={actionLoading}
              >
                {t('markNoShow')}
              </Button>
            </div>
          )}

          {/* Completion Form */}
          {showCompleteForm && (
            <Card className="mb-6">
              <h2 className="mb-4 text-lg font-semibold">{td('completionForm')}</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">{td('clinicalNotes')}</label>
                  <textarea
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="followUp"
                    checked={followUpRequired}
                    onChange={(e) => setFollowUpRequired(e.target.checked)}
                  />
                  <label htmlFor="followUp" className="text-sm">{td('followUpRequired')}</label>
                </div>
                {followUpRequired && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">{td('followUpDueDate')}</label>
                    <input
                      type="date"
                      value={followUpDueDate}
                      onChange={(e) => setFollowUpDueDate(e.target.value)}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium">{td('nextDentalDueDate')}</label>
                  <input
                    type="date"
                    value={nextDentalDueDate}
                    onChange={(e) => setNextDentalDueDate(e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleComplete} disabled={actionLoading}>
                    {td('submitCompletion')}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCompleteForm(false)}>
                    {tc('cancel')}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Visit Outcome (if completed) */}
          {appointment.visitOutcome && (
            <Card className="mb-6">
              <h2 className="mb-4 text-lg font-semibold">{td('visitOutcome')}</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted">{td('clinicalNotes')}</span>
                  <p className="text-sm">{appointment.visitOutcome.notes ?? '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted">{td('followUpRequired')}</span>
                  <p className="text-sm">{appointment.visitOutcome.followUpRequired ? tc('yes') : tc('no')}</p>
                </div>
                {appointment.visitOutcome.followUpDueDate && (
                  <div>
                    <span className="text-xs text-muted">{td('followUpDueDate')}</span>
                    <p className="text-sm">{formatDate(appointment.visitOutcome.followUpDueDate)}</p>
                  </div>
                )}
                {appointment.visitOutcome.nextDentalDueDate && (
                  <div>
                    <span className="text-xs text-muted">{td('nextDentalDueDate')}</span>
                    <p className="text-sm">{formatDate(appointment.visitOutcome.nextDentalDueDate)}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Cancellation Reason */}
          {appointment.cancellationReason && (
            <Card className="mb-6 border-danger/30 bg-red-50/50">
              <h2 className="mb-2 text-lg font-semibold">{t('cancelReason')}</h2>
              <p className="text-sm">{appointment.cancellationReason}</p>
            </Card>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
