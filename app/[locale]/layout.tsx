import type { Metadata, Viewport } from 'next';
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
  themeColor: '#1e40af',
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
    <html lang={locale} className="h-full">
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
