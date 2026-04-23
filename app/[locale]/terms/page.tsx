import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

interface TermsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: TermsPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });
  return { title: `${t('terms.title')} — EquiSmile` };
}

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 prose prose-slate">
      <nav className="mb-6 text-sm">
        <Link href={`/${locale}`} className="text-primary hover:underline">
          ← {t('backHome')}
        </Link>
      </nav>

      <h1>{t('terms.title')}</h1>
      <p className="text-sm text-gray-500">{t('terms.lastUpdated')}</p>

      <section>
        <h2>{t('terms.scope.heading')}</h2>
        <p>{t('terms.scope.body')}</p>
      </section>

      <section>
        <h2>{t('terms.accounts.heading')}</h2>
        <p>{t('terms.accounts.body')}</p>
      </section>

      <section>
        <h2>{t('terms.acceptableUse.heading')}</h2>
        <p>{t('terms.acceptableUse.body')}</p>
      </section>

      <section>
        <h2>{t('terms.clinicalDisclaimer.heading')}</h2>
        <p>{t('terms.clinicalDisclaimer.body')}</p>
      </section>

      <section>
        <h2>{t('terms.availability.heading')}</h2>
        <p>{t('terms.availability.body')}</p>
      </section>

      <section>
        <h2>{t('terms.changes.heading')}</h2>
        <p>{t('terms.changes.body')}</p>
      </section>

      <section>
        <h2>{t('terms.contact.heading')}</h2>
        <p>{t('terms.contact.body')}</p>
      </section>
    </main>
  );
}
