'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface DemoStatus {
  demoMode: boolean;
  maps?: {
    liveRequested: boolean;
    live: boolean;
    missing: string[];
  };
}

/**
 * Renders an amber banner on demo deployments where the operator
 * requested live Google Maps (EQUISMILE_LIVE_MAPS=true) but one or
 * more of the three required env vars is unset. Falls silent in
 * every other state (production, demo without live-maps opt-in, or
 * fully-configured demo).
 *
 * Closes Finding 2 of docs/UAT_v1_1_TRIAGE_round2.md — the silent
 * fallback to the simulator made Rachel report the live-Maps
 * differentiator as undemonstrable. This banner makes the env gap
 * loud at first glance and points the operator at the runbook.
 */
export function DemoMapsConfigBanner() {
  const t = useTranslations('demo.mapsBanner');
  const [status, setStatus] = useState<DemoStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/demo/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Silent in any state that isn't "demo + opted-in + missing keys".
  if (!status?.demoMode) return null;
  if (!status.maps?.liveRequested) return null;
  if (status.maps.live) return null;
  if (status.maps.missing.length === 0) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p className="font-medium">{t('title')}</p>
      <p className="mt-1">{t('body')}</p>
      <ul className="mt-2 list-inside list-disc text-xs font-mono">
        {status.maps.missing.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs">{t('runbook')}</p>
    </div>
  );
}
