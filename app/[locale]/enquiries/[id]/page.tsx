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
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Link } from '@/i18n/navigation';
import { MessageThread } from '@/components/ui/MessageThread';

interface EnquiryDetail {
  id: string;
  channel: string;
  triageStatus: string;
  rawText: string;
  subject: string | null;
  receivedAt: string;
  sourceFrom: string;
  customer: { id: string; fullName: string; mobilePhone: string | null; email: string | null } | null;
  yard: { id: string; yardName: string; postcode: string; town: string } | null;
  visitRequests: Array<{
    id: string;
    requestType: string;
    urgencyLevel: string;
    planningStatus: string;
    horseCount: number | null;
    preferredDays: string[];
    needsMoreInfo: boolean;
    triageTasks: Array<{ id: string; taskType: string; status: string }>;
    yard: { id: string; yardName: string; postcode: string } | null;
  }>;
  messages: Array<{ id: string; direction: string; channel: string; messageText: string; sentOrReceivedAt: string }>;
}

export default function EnquiryDetailPage() {
  const t = useTranslations('enquiries');
  const tc = useTranslations('common');
  const tStatus = useTranslations('status');
  const tReq = useTranslations('requestTypes');
  const tMsg = useTranslations('messages');
  const params = useParams();
  const id = params.id as string;
  const [enquiry, setEnquiry] = useState<EnquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/enquiries/${id}`)
      .then(r => { if (r.ok) return r.json(); return null; })
      .then(data => { if (!cancelled) { if (data) setEnquiry(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id, refreshKey]);

  const handleTriageAction = async (action: string) => {
    if (!enquiry?.visitRequests[0]) return;
    const vrId = enquiry.visitRequests[0].id;
    if (action === 'classify') {
      await fetch(`/api/visit-requests/${vrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningStatus: 'READY_FOR_REVIEW' }),
      });
      await fetch(`/api/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triageStatus: 'TRIAGED' }),
      });
    } else if (action === 'needsInfo') {
      await fetch(`/api/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triageStatus: 'NEEDS_INFO' }),
      });
      await fetch(`/api/visit-requests/${vrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ needsMoreInfo: true }),
      });
    } else if (action === 'planning') {
      await fetch(`/api/visit-requests/${vrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningStatus: 'PLANNING_POOL', needsMoreInfo: false }),
      });
      await fetch(`/api/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triageStatus: 'TRIAGED' }),
      });
    }
    setRefreshKey(k => k + 1);
  };

  if (loading) return <div className="flex h-full flex-col"><Header /><div className="flex flex-1 overflow-hidden"><Sidebar /><main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6"><LoadingState /></main></div><MobileNav /></div>;
  if (!enquiry) return <div className="flex h-full flex-col"><Header /><div className="flex flex-1 overflow-hidden"><Sidebar /><main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6"><p className="text-muted">{tc('noResults')}</p></main></div><MobileNav /></div>;

  const requestTypeKey = (rt: string) => {
    const map: Record<string, string> = { ROUTINE_DENTAL: 'routineDental', FOLLOW_UP: 'followUp', URGENT_ISSUE: 'urgentIssue', FIRST_VISIT: 'firstVisit', ADMIN: 'admin' };
    return map[rt] || rt;
  };

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <div className="mb-4"><Link href="/enquiries" className="text-sm text-primary hover:underline">&larr; {tc('back')}</Link></div>
          <PageHeader title={t('detail.title')} subtitle={enquiry.subject || undefined} />

          {/* Status row */}
          <div className="mb-4 flex flex-wrap gap-2">
            <StatusBadge type="triage" value={enquiry.triageStatus} />
            <StatusBadge type="channel" value={enquiry.channel} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Message */}
            <Card>
              <h3 className="mb-3 text-sm font-medium text-muted">{t('detail.rawMessage')}</h3>
              <p className="whitespace-pre-wrap text-sm">{enquiry.rawText}</p>
              <p className="mt-3 text-xs text-muted">{t('received')}: {new Date(enquiry.receivedAt).toLocaleString()}</p>
            </Card>

            {/* Customer and Yard info */}
            <div className="space-y-4">
              {enquiry.customer && (
                <Card>
                  <h3 className="mb-2 text-sm font-medium text-muted">{t('customer')}</h3>
                  <Link href={`/customers/${enquiry.customer.id}`} className="font-medium text-primary hover:underline">{enquiry.customer.fullName}</Link>
                  {enquiry.customer.mobilePhone && <p className="text-xs text-muted">{enquiry.customer.mobilePhone}</p>}
                  {enquiry.customer.email && <p className="text-xs text-muted">{enquiry.customer.email}</p>}
                </Card>
              )}
              {enquiry.yard && (
                <Card>
                  <h3 className="mb-2 text-sm font-medium text-muted">{t('yard')}</h3>
                  <Link href={`/yards/${enquiry.yard.id}`} className="font-medium text-primary hover:underline">{enquiry.yard.yardName}</Link>
                  <p className="text-xs text-muted">{enquiry.yard.postcode}, {enquiry.yard.town}</p>
                </Card>
              )}
            </div>
          </div>

          {/* Visit Requests */}
          {enquiry.visitRequests.length > 0 && (
            <Card className="mt-4">
              <h3 className="mb-3 text-sm font-medium text-muted">{t('detail.visitRequests')}</h3>
              {enquiry.visitRequests.map((vr) => (
                <div key={vr.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge type="urgency" value={vr.urgencyLevel} />
                    <StatusBadge type="planning" value={vr.planningStatus} />
                    <span className="text-sm">{tReq(requestTypeKey(vr.requestType))}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    {vr.horseCount && <span>{vr.horseCount} horses</span>}
                    {vr.preferredDays.length > 0 && <span className="ml-3">{vr.preferredDays.join(', ')}</span>}
                    {vr.needsMoreInfo && <span className="ml-3 text-amber-600">{tStatus('needsInfo')}</span>}
                  </div>
                  {vr.triageTasks.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {vr.triageTasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-2 text-xs">
                          <StatusBadge type="taskStatus" value={task.status} />
                          <span>{task.taskType}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}

          {/* Message Thread */}
          {enquiry.messages && enquiry.messages.length > 0 && (
            <Card className="mt-4">
              <h3 className="mb-3 text-sm font-medium text-muted">{tMsg('title')}</h3>
              <MessageThread messages={enquiry.messages} />
            </Card>
          )}

          {/* Actions */}
          <Card className="mt-4">
            <h3 className="mb-3 text-sm font-medium text-muted">{t('detail.actions')}</h3>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleTriageAction('classify')}>{t('detail.classify')}</Button>
              <Button size="sm" variant="secondary" onClick={() => handleTriageAction('needsInfo')}>{t('detail.requestInfo')}</Button>
              <Button size="sm" variant="secondary" onClick={() => handleTriageAction('planning')}>{t('detail.moveToPlanningPool')}</Button>
            </div>
          </Card>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
