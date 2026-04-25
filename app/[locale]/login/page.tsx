import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { SignInButton } from '@/components/auth/SignInButton';
import { auth } from '@/auth';
import { env } from '@/lib/env';
import { getProviderAvailability } from '@/lib/auth/providers';
import { safeCallbackUrl } from '@/lib/auth/redirect';
import { redirect } from 'next/navigation';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; callbackUrl?: string; verify?: string }>;
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const [{ locale }, { error, callbackUrl, verify }] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: 'auth' });

  // Only accept same-origin relative callback paths.
  const safeCallback = safeCallbackUrl(callbackUrl, `/${locale}`);

  const session = await auth();
  if (session?.user) {
    redirect(safeCallback);
  }

  const providers = getProviderAvailability();
  const demoMode = env.DEMO_MODE === 'true';

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900">{t('loginTitle')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('loginSubtitle')}</p>
        </div>
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {t('notAuthorised')}
          </div>
        )}
        {verify && (
          <div
            role="status"
            className="mb-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900"
          >
            {t('checkInbox')}
          </div>
        )}
        {demoMode && (
          /*
           * Demo-only sign-in. Posts to /api/demo/sign-in which
           * upserts a "Demo Vet" admin user, mints a Prisma session
           * row, sets the auth cookie, then 303-redirects to
           * /en/dashboard. The endpoint hard-blocks outside DEMO_MODE
           * so this can never become a real sign-in bypass.
           */
          <form action="/api/demo/sign-in" method="POST" className="mb-4">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              Continue as Demo Vet
            </button>
            <p className="mt-2 text-center text-xs text-gray-500">
              Demo mode — full admin access, all integrations simulated.
            </p>
          </form>
        )}
        {(providers.github || providers.email) && demoMode && (
          <div className="my-4 flex items-center gap-3 text-xs uppercase text-gray-400">
            <span aria-hidden="true" className="h-px flex-1 bg-gray-200" />
            <span>or</span>
            <span aria-hidden="true" className="h-px flex-1 bg-gray-200" />
          </div>
        )}
        <SignInButton
          callbackUrl={safeCallback}
          githubEnabled={providers.github}
          emailEnabled={providers.email}
        />
        <footer className="mt-6 flex justify-center gap-4 border-t border-gray-200 pt-4 text-xs text-gray-500">
          <Link href={`/${locale}/privacy`} className="hover:underline">
            {t('privacyLink')}
          </Link>
          <span aria-hidden="true">·</span>
          <Link href={`/${locale}/terms`} className="hover:underline">
            {t('termsLink')}
          </Link>
        </footer>
      </div>
    </main>
  );
}
