'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Persona {
  email: string;
  name: string;
  role: string;
  badge: string;
  colour: string;
}

const PERSONAS: Persona[] = [
  { email: 'rachel@equismile.demo', name: 'Dr. Rachel Kemp', role: 'admin', badge: 'Admin', colour: 'bg-red-100 text-red-800' },
  { email: 'alex@equismile.demo', name: 'Dr. Alex Moreau', role: 'vet', badge: 'Senior Vet', colour: 'bg-blue-100 text-blue-800' },
  { email: 'sophie@equismile.demo', name: 'Dr. Sophie Laurent', role: 'vet', badge: 'Junior Vet', colour: 'bg-violet-100 text-violet-800' },
  { email: 'lea@equismile.demo', name: 'Léa Bertrand', role: 'nurse', badge: 'Nurse', colour: 'bg-green-100 text-green-800' },
  { email: 'marc@equismile.demo', name: 'Marc Dubois', role: 'readonly', badge: 'Receptionist', colour: 'bg-orange-100 text-orange-800' },
];

interface Props {
  locale: string;
  callbackUrl?: string;
}

export function DemoSignInButton({ locale, callbackUrl }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleSignIn = async (persona: Persona) => {
    setLoading(persona.email);
    setError(null);
    try {
      const body = new FormData();
      body.append('locale', locale);
      body.append('persona', persona.email);
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
          redirectTo?: unknown;
        };
        const redirectTo =
          typeof data.redirectTo === 'string' && data.redirectTo.startsWith('/')
            ? data.redirectTo
            : undefined;
        router.push(redirectTo ?? callbackUrl ?? `/${locale}/dashboard`);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? 'Sign-in failed. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(null);
    }
  };

  const defaultPersona = PERSONAS[0];

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

      {/* Primary quick sign-in button */}
      <button
        type="button"
        onClick={() => handleSignIn(defaultPersona)}
        disabled={loading !== null}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading === defaultPersona.email && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
          />
        )}
        {locale === 'fr' ? 'Continuer comme vétérinaire démo' : 'Continue as Demo Vet'}
      </button>

      {/* Persona picker toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="demo-persona-list"
        className="mt-2 w-full text-center text-xs text-gray-500 hover:text-gray-700 transition"
      >
        {expanded
          ? (locale === 'fr' ? '▲ Masquer les personas' : '▲ Hide test personas')
          : (locale === 'fr' ? '▼ Choisir un persona de test' : '▼ Choose a test persona')}
      </button>

      {/* Persona list */}
      {expanded && (
        <div id="demo-persona-list" className="mt-2 space-y-1.5">
          {PERSONAS.map((p) => (
            <button
              key={p.email}
              type="button"
              onClick={() => handleSignIn(p)}
              disabled={loading !== null}
              className="flex w-full items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2.5 text-left text-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading === p.email && (
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"
                />
              )}
              <span className="flex-1 truncate font-medium text-gray-900">{p.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${p.colour}`}>
                {p.badge}
              </span>
            </button>
          ))}
          <p className="pt-1 text-center text-[11px] text-gray-400">
            {locale === 'fr'
              ? 'Chaque persona a des permissions différentes.'
              : 'Each persona has different permissions.'}
          </p>
        </div>
      )}

      {!expanded && (
        <p className="mt-1 text-center text-xs text-gray-500">
          {locale === 'fr'
            ? 'Mode démo — accès admin complet, intégrations simulées.'
            : 'Demo mode — full admin access, all integrations simulated.'}
        </p>
      )}
    </div>
  );
}
