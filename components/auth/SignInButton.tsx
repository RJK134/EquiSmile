'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface SignInButtonProps {
  callbackUrl?: string;
  emailEnabled?: boolean;
  githubEnabled?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInButton({
  callbackUrl = '/',
  emailEnabled = false,
  githubEnabled = true,
}: SignInButtonProps) {
  const t = useTranslations('auth');
  const [pendingGithub, setPendingGithub] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const submitEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(t('emailRequired'));
      return;
    }
    setEmailError(null);
    setPendingEmail(true);
    try {
      await signIn('nodemailer', { email: email.trim(), callbackUrl });
    } catch {
      setEmailError(t('linkSendFailed'));
      setPendingEmail(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {githubEnabled && (
        <button
          type="button"
          disabled={pendingGithub}
          onClick={() => {
            setPendingGithub(true);
            signIn('github', { callbackUrl });
          }}
          className="inline-flex w-full items-center justify-center gap-3 rounded-md bg-gray-900 px-4 py-3 text-base font-medium text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 4.99 3.23 9.22 7.72 10.72.56.1.77-.24.77-.54 0-.27-.01-1.16-.02-2.11-3.14.68-3.8-1.34-3.8-1.34-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.28.94.1-.73.39-1.23.71-1.51-2.51-.29-5.15-1.25-5.15-5.57 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.44.11-3 0 0 .95-.3 3.11 1.16.9-.25 1.87-.38 2.83-.38.96 0 1.93.13 2.83.38 2.16-1.46 3.11-1.16 3.11-1.16.62 1.56.23 2.71.11 3 .72.79 1.15 1.8 1.15 3.03 0 4.33-2.65 5.27-5.17 5.55.4.35.76 1.04.76 2.1 0 1.52-.01 2.75-.01 3.12 0 .3.2.65.78.54 4.49-1.5 7.71-5.73 7.71-10.72C23.33 5.56 18.27.5 12 .5z" />
          </svg>
          <span>{pendingGithub ? t('signingIn') : t('signInWithGithub')}</span>
        </button>
      )}

      {githubEnabled && emailEnabled && (
        <div className="flex items-center gap-3 text-xs uppercase text-gray-400">
          <span aria-hidden="true" className="h-px flex-1 bg-gray-200" />
          <span>{t('or')}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-gray-200" />
        </div>
      )}

      {emailEnabled && (
        <form onSubmit={submitEmail} className="flex flex-col gap-2" noValidate>
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            {t('emailLabel')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-700"
            disabled={pendingEmail}
          />
          {emailError && (
            <p role="alert" className="text-sm text-red-700">
              {emailError}
            </p>
          )}
          <button
            type="submit"
            disabled={pendingEmail}
            className="inline-flex w-full items-center justify-center rounded-md bg-gray-100 px-4 py-3 text-base font-medium text-gray-900 shadow-sm transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingEmail ? t('sendingMagicLink') : t('sendMagicLink')}
          </button>
        </form>
      )}
    </div>
  );
}
