// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { DemoMapsConfigBanner } from '@/components/demo/DemoMapsConfigBanner';

// ---------------------------------------------------------------------------
// next-intl mock — namespace-aware, fail-loud on missing keys.
// ---------------------------------------------------------------------------

const T_TABLE: Record<string, Record<string, string>> = {
  'demo.mapsBanner': {
    title: 'Live Google Maps requested but not configured',
    body: 'Live demo requested but env vars missing.',
    runbook: 'See docs/DEMO_RUNBOOK.md §2.',
  },
};

vi.mock('next-intl', () => ({
  useTranslations:
    (namespace: string) =>
    (key: string): string =>
      T_TABLE[namespace]?.[key] ?? `MISSING:${namespace}.${key}`,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockStatus(body: unknown, ok = true): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  });
}

// ---------------------------------------------------------------------------
// Render-gate suite — four states.
// ---------------------------------------------------------------------------

describe('DemoMapsConfigBanner', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the banner when demo + liveRequested + missing keys', async () => {
    mockStatus({
      demoMode: true,
      maps: {
        liveRequested: true,
        live: false,
        missing: ['GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY'],
      },
    });

    render(<DemoMapsConfigBanner />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('Live Google Maps requested but not configured'),
    ).toBeInTheDocument();
    expect(screen.getByText('GOOGLE_MAPS_API_KEY')).toBeInTheDocument();
    expect(
      screen.getByText('NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY'),
    ).toBeInTheDocument();
  });

  it('does NOT render when liveRequested + all keys present', async () => {
    mockStatus({
      demoMode: true,
      maps: { liveRequested: true, live: true, missing: [] },
    });

    const { container } = render(<DemoMapsConfigBanner />);

    // Wait long enough for the fetch then render to flush.
    await waitFor(() => {
      // Banner must be absent.
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(container.firstChild).toBeNull();
  });

  it('does NOT render when liveRequested is false (operator opted out)', async () => {
    mockStatus({
      demoMode: true,
      maps: {
        liveRequested: false,
        live: false,
        missing: ['GOOGLE_MAPS_API_KEY'],
      },
    });

    const { container } = render(<DemoMapsConfigBanner />);
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(container.firstChild).toBeNull();
  });

  it('does NOT render in production (demoMode = false)', async () => {
    mockStatus({
      demoMode: false,
      maps: {
        liveRequested: false,
        live: false,
        missing: ['GOOGLE_MAPS_API_KEY'],
      },
    });

    const { container } = render(<DemoMapsConfigBanner />);
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(container.firstChild).toBeNull();
  });

  it('does NOT render when /api/demo/status returns non-ok', async () => {
    mockStatus({}, false);
    const { container } = render(<DemoMapsConfigBanner />);
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(container.firstChild).toBeNull();
  });

  it('does NOT render when /api/demo/status fetch throws', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = vi
      .fn()
      .mockRejectedValue(new Error('network'));
    const { container } = render(<DemoMapsConfigBanner />);
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(container.firstChild).toBeNull();
  });
});
