import { getTranslations } from 'next-intl/server';

import { SignInButton } from '@/components/auth/SignInButton';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

const CALLBACK_URL_ORIGIN = 'http://localhost';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}

function getSafeCallbackUrl(callbackUrl: string | undefined, locale: string) {
  const fallbackUrl = `/${locale}`;

  if (!callbackUrl?.startsWith('/')) {
    return fallbackUrl;
  }

  try {
    const parsedCallbackUrl = new URL(callbackUrl, CALLBACK_URL_ORIGIN);

    if (parsedCallbackUrl.origin !== CALLBACK_URL_ORIGIN) {
      return fallbackUrl;
    }

    return `${parsedCallbackUrl.pathname}${parsedCallbackUrl.search}${parsedCallbackUrl.hash}`;
  } catch {
    return fallbackUrl;
  }
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const [{ locale }, { error, callbackUrl }] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: 'auth' });
  const safeCallbackUrl = getSafeCallbackUrl(callbackUrl, locale);

  const session = await auth();
  if (session?.user) {
    redirect(safeCallbackUrl);
  }

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
        <SignInButton callbackUrl={callbackUrl ?? `/${locale}`} />
      </div>
    </main>
  );
}
