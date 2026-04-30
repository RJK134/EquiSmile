'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFormatter } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { SkipToContent } from '@/components/ui/SkipToContent';

interface DemoStatus {
  demoMode: boolean;
  integrations: Record<string, string>;
  counts: Record<string, number>;
  breakdown: {
    enquiries: Record<string, number>;
    visitRequests: Record<string, number>;
    routeRuns: Record<string, number>;
  };
}

interface ActionResult {
  action: string;
  success: boolean;
  data: unknown;
  timestamp: string;
}

export default function DemoPage() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionResults, setActionResults] = useState<ActionResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const format = useFormatter();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/demo/status');
      if (res.status === 403) {
        setStatus(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const runAction = async (action: string, url: string, body?: Record<string, unknown>) => {
    setRunning(action);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      setActionResults((prev) => [
        { action, success: res.ok, data, timestamp: new Date().toISOString() },
        ...prev.slice(0, 9),
      ]);
      await fetchStatus();
    } catch (err) {
      setActionResults((prev) => [
        { action, success: false, data: { error: String(err) }, timestamp: new Date().toISOString() },
        ...prev.slice(0, 9),
      ]);
    } finally {
      setRunning(null);
    }
  };

  const runFullDayWorkflow = async () => {
    setRunning('full-day');
    const steps = [
      { action: 'WhatsApp EN', url: '/api/demo/simulate-whatsapp', body: { language: 'en' } },
      { action: 'WhatsApp FR', url: '/api/demo/simulate-whatsapp', body: { language: 'fr' } },
      { action: 'Email EN', url: '/api/demo/simulate-email', body: { language: 'en' } },
      { action: 'Email FR', url: '/api/demo/simulate-email', body: { language: 'fr' } },
      { action: 'Triage', url: '/api/demo/trigger-triage' },
      { action: 'Routes', url: '/api/demo/generate-routes' },
    ];

    for (const step of steps) {
      await runAction(step.action, step.url, step.body);
    }
    setRunning(null);
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <SkipToContent />
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main id="main-content" className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
            <p className="text-sm text-muted">Loading demo status...</p>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!status || !status.demoMode) {
    return (
      <div className="flex h-full flex-col">
        <SkipToContent />
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main id="main-content" className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
            <Card>
              <h1 className="text-lg font-bold text-danger">Demo Mode Disabled</h1>
              <p className="mt-2 text-sm text-muted">
                Set <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">DEMO_MODE=true</code> in your environment to enable the demo control panel.
              </p>
            </Card>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <SkipToContent />
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          {/* Demo Banner */}
          <div className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3">
            <p className="text-sm font-bold text-amber-800">
              DEMO MODE &mdash; Simulated integrations
            </p>
            <p className="text-xs text-amber-700">
              All external APIs (WhatsApp, Email, Google Maps, n8n) are using simulated responses.
              / Toutes les API externes utilisent des réponses simulées.
            </p>
          </div>

          <h1 className="mb-4 text-xl font-bold">Demo Control Panel / Panneau de contrôle</h1>

          {/* Integration Status */}
          <Card className="mb-4">
            <h2 className="mb-2 text-sm font-semibold">Integration Status / État des intégrations</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(status.integrations).map(([name, mode]) => (
                <div key={name} className="rounded border border-border p-2 text-center">
                  <p className="text-xs font-medium text-muted">{name}</p>
                  <p className={`text-sm font-bold ${mode === 'demo' ? 'text-amber-600' : 'text-green-600'}`}>
                    {mode.toUpperCase()}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Data Counts */}
          <Card className="mb-4">
            <h2 className="mb-2 text-sm font-semibold">Data Counts / Données</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              {Object.entries(status.counts).map(([name, count]) => (
                <div key={name} className="rounded border border-border p-2 text-center">
                  <p className="text-xs text-muted">{name}</p>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Simulation Actions */}
          <Card className="mb-4">
            <h2 className="mb-3 text-sm font-semibold">Simulation Actions / Actions de simulation</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={running !== null}
                onClick={() => runAction('WhatsApp EN', '/api/demo/simulate-whatsapp', { language: 'en' })}
              >
                {running === 'WhatsApp EN' ? 'Sending...' : 'Simulate WhatsApp (EN)'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={running !== null}
                onClick={() => runAction('WhatsApp FR', '/api/demo/simulate-whatsapp', { language: 'fr' })}
              >
                {running === 'WhatsApp FR' ? 'Envoi...' : 'Simulate WhatsApp (FR)'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={running !== null}
                onClick={() => runAction('Email EN', '/api/demo/simulate-email', { language: 'en' })}
              >
                {running === 'Email EN' ? 'Sending...' : 'Simulate Email (EN)'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={running !== null}
                onClick={() => runAction('Email FR', '/api/demo/simulate-email', { language: 'fr' })}
              >
                {running === 'Email FR' ? 'Envoi...' : 'Simulate Email (FR)'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={running !== null}
                onClick={() => runAction('Triage', '/api/demo/trigger-triage')}
              >
                {running === 'Triage' ? 'Processing...' : 'Trigger Triage'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={running !== null}
                onClick={() => runAction('Routes', '/api/demo/generate-routes')}
              >
                {running === 'Routes' ? 'Generating...' : 'Generate Routes'}
              </Button>
            </div>

            <div className="mt-3 border-t border-border pt-3">
              <Button
                variant="primary"
                size="md"
                disabled={running !== null}
                onClick={runFullDayWorkflow}
              >
                {running === 'full-day' ? 'Running workflow...' : 'Simulate Full Day Workflow / Simuler une journée complète'}
              </Button>
            </div>
          </Card>

          {/* Action Results */}
          {actionResults.length > 0 && (
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Results / Résultats</h2>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {actionResults.map((result, i) => (
                  <div
                    key={`${result.timestamp}-${i}`}
                    className={`rounded border p-2 text-xs ${
                      result.success
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.action}</span>
                      <span className="text-muted">
                        {format.dateTime(new Date(result.timestamp), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
