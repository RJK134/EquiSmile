'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  locale: string;
  callbackUrl?: string;
}

export function DemoSignInButton({ locale, callbackUrl }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('locale', locale);
      const res = await fetch('/api/demo/sign-in', {
        method: 'POST',
        body,
        credentials: 'same-origin',
      });
      if (res.ok) {
        // The endpoint returns { ok: true, redirectTo } since the
        // 303→200+JSON contract change. Fall back to the prop-supplied
        // callback or the locale dashboard if the body is malformed.
        const data = (await res.json().catch(() => ({}))) as {
          redirectTo?: string;
        };
        router.push(data.redirectTo ?? callbackUrl ?? `/${locale}/dashboard`);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? 'Sign-in failed. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
          />
        )}
        {locale === 'fr' ? 'Continuer comme vétérinaire démo' : 'Continue as Demo Vet'}
      </button>
      <p className="mt-2 text-center text-xs text-gray-500">
        {locale === 'fr'
          ? 'Mode démo — accès admin complet, intégrations simulées.'
          : 'Demo mode — full admin access, all integrations simulated.'}
      </p>
    </div>
  );
}
