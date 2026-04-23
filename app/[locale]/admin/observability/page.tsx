import { getTranslations } from 'next-intl/server';

import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkipToContent } from '@/components/ui/SkipToContent';
import { ObservabilityDashboard } from '@/components/admin/ObservabilityDashboard';

interface ObservabilityPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ObservabilityPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'observability' });
  return { title: `${t('title')} — EquiSmile` };
}

/**
 * Admin observability page.
 *
 * Server-renders the page shell and delegates live data to the client
 * component which polls `/api/admin/observability` every 30 s. The
 * endpoint is admin-only; if a lower-privilege user somehow reaches
 * this URL they'll see an inline error rather than a raw 403.
 */
export default async function ObservabilityPage({ params }: ObservabilityPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'observability' });

  return (
    <div className="min-h-screen bg-surface">
      <SkipToContent />
      <Header />
      <div className="mx-auto flex max-w-6xl">
        <Sidebar />
        <main id="main-content" className="flex-1 px-4 py-6 pb-24 lg:pb-6">
          <PageHeader title={t('title')} subtitle={t('subtitle')} />
          <ObservabilityDashboard locale={locale} />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
