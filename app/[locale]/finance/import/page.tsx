'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';

interface ImportResult {
  ok: boolean;
  batchId?: string;
  entryCount?: number;
  matchedCount?: number;
  error?: string;
}

export default function FinanceImportPage() {
  const t = useTranslations('finance.import');
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<'CAMT_054' | 'CSV'>('CSV');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    const text = await file.text();
    const res = await fetch('/api/finance/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, format, content: text }),
    });
    const json = (await res.json().catch(() => ({}))) as Partial<ImportResult>;
    setResult({ ...json, ok: res.ok && Boolean(json.ok) });
    setLoading(false);
  };

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <PageHeader title={t('title')} subtitle={t('subtitle')} />

          <Card>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">{t('formatLabel')}</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as 'CAMT_054' | 'CSV')}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="CSV">CSV</option>
                  <option value="CAMT_054">CAMT.054 (XML)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{t('fileLabel')}</label>
                <input
                  type="file"
                  accept={format === 'CSV' ? '.csv,text/csv' : '.xml,text/xml,application/xml'}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block text-sm"
                />
                {file && (
                  <p className="mt-1 text-xs text-muted">
                    {file.name} — {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>

              <Button onClick={submit} disabled={!file || loading}>
                {loading ? t('importing') : t('importButton')}
              </Button>

              {result && (
                <div
                  role="status"
                  className={`rounded-md border p-3 text-sm ${
                    result.ok
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-red-300 bg-red-50 text-red-900'
                  }`}
                >
                  {result.ok ? (
                    <p>
                      {t('importSuccess', {
                        entryCount: result.entryCount ?? 0,
                        matchedCount: result.matchedCount ?? 0,
                      })}
                    </p>
                  ) : (
                    <p>
                      {t('importFailure')} {result.error ?? ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          <p className="mt-6 text-xs text-muted">{t('csvHint')}</p>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
