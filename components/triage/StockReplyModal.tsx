'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { STOCK_REPLY_TEMPLATES, type StockReplyTemplateName } from '@/lib/demo/template-registry';
import { buildStockReplyBody } from '@/lib/services/stock-reply.service';

/**
 * Modal that lets a vet pick one of four stock-reply templates, preview
 * the bilingual body, and confirm-and-send. G-2b from the May 2026
 * client user-story triage.
 *
 * The body preview is rendered with the customer's actual name + their
 * preferred language so the operator sees exactly what will land on
 * the customer's WhatsApp / inbox.
 */

export interface StockReplyModalProps {
  visitRequestId: string;
  customerName: string;
  customerLanguage: 'en' | 'fr' | string;
  onClose: () => void;
  onSent: (template: StockReplyTemplateName) => void;
}

export function StockReplyModal({
  visitRequestId,
  customerName,
  customerLanguage,
  onClose,
  onSent,
}: StockReplyModalProps) {
  const t = useTranslations('triage.stockReply');
  const tc = useTranslations('common');
  const [selected, setSelected] = useState<StockReplyTemplateName | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lang = customerLanguage === 'fr' ? 'fr' : 'en';
  const previewBody = selected ? buildStockReplyBody(selected, customerName, lang) : '';

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/triage-ops/stock-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitRequestId, template: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t('sendError'));
        setSending(false);
        return;
      }
      onSent(selected);
    } catch {
      setError(t('sendError'));
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg">
        <h3 className="mb-2 text-base font-semibold">{t('title')}</h3>
        <p className="mb-3 text-xs text-muted">{t('subtitle')}</p>
        {error && (
          <div role="alert" className="mb-3 rounded-md border border-danger/30 bg-red-50 p-2 text-xs text-danger">
            {error}
          </div>
        )}
        <div className="space-y-2">
          {STOCK_REPLY_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl}
              type="button"
              onClick={() => setSelected(tmpl)}
              className={`w-full rounded-md border p-2 text-left text-sm transition ${
                selected === tmpl
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/40'
              }`}
              aria-pressed={selected === tmpl}
            >
              {t(`templates.${tmpl}`)}
            </button>
          ))}
        </div>
        {selected && (
          <div className="mt-4 rounded-md border border-border bg-muted/10 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('preview')}
            </p>
            <p className="text-sm whitespace-pre-wrap">{previewBody}</p>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={sending}>
            {tc('cancel')}
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!selected || sending}
          >
            {sending ? t('sending') : t('send')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
