import { getTranslations } from 'next-intl/server';

import { SignInButton } from '@/components/auth/SignInButton';
import { auth } from '@/auth';
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
        <SignInButton
          callbackUrl={safeCallback}
          githubEnabled={providers.github}
          emailEnabled={providers.email}
        />
      </div>
    </main>
  );
}
