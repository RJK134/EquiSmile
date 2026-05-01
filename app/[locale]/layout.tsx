import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { AuthSessionProvider } from '@/components/auth/AuthSessionProvider';
import { auth } from '@/auth';
import '@/app/globals.css';

// Display: Instrument Serif (Google Fonts) — used for page titles +
// hero copy on equismile.ch. Single weight (400) + italic.
const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display-runtime',
  display: 'swap',
});

// Body: Plus Jakarta Sans (Google Fonts) is shipped here as a
// placeholder for General Sans (Fontshare). Once the Fontshare
// .woff2 assets are dropped into public/fonts/, swap this for a
// `next/font/local` block keyed off the same `--font-sans-runtime`
// variable; no other call site needs to change.
const generalSansPlaceholder = Plus_Jakarta_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans-runtime',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EquiSmile — Equine Dental Operations',
  description:
    'Mobile-first field-service operations platform for equine dental veterinary practice.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#9b214d',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [messages, session] = await Promise.all([getMessages(), auth()]);

  return (
    <html
      lang={locale}
      className={`h-full ${instrumentSerif.variable} ${generalSansPlaceholder.variable}`}
    >
      <body className="h-full bg-surface text-foreground antialiased">
        <AuthSessionProvider session={session}>
          <NextIntlClientProvider messages={messages}>
            <ErrorBoundary>
              <ToastProvider>
                <OfflineBanner />
                {children}
              </ToastProvider>
            </ErrorBoundary>
          </NextIntlClientProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
