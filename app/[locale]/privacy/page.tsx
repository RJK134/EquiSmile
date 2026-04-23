import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

interface PrivacyPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PrivacyPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });
  return { title: `${t('privacy.title')} — EquiSmile` };
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal' });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 prose prose-slate">
      <nav className="mb-6 text-sm">
        <Link href={`/${locale}`} className="text-primary hover:underline">
          ← {t('backHome')}
        </Link>
      </nav>

      <h1>{t('privacy.title')}</h1>
      <p className="text-sm text-gray-500">{t('privacy.lastUpdated')}</p>

      <section>
        <h2>{t('privacy.controller.heading')}</h2>
        <p>{t('privacy.controller.body')}</p>
      </section>

      <section>
        <h2>{t('privacy.data.heading')}</h2>
        <p>{t('privacy.data.intro')}</p>
        <ul>
          <li>{t('privacy.data.customer')}</li>
          <li>{t('privacy.data.messages')}</li>
          <li>{t('privacy.data.clinical')}</li>
          <li>{t('privacy.data.location')}</li>
          <li>{t('privacy.data.audit')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('privacy.lawful.heading')}</h2>
        <p>{t('privacy.lawful.body')}</p>
      </section>

      <section>
        <h2>{t('privacy.retention.heading')}</h2>
        <p>{t('privacy.retention.body')}</p>
      </section>

      <section>
        <h2>{t('privacy.sharing.heading')}</h2>
        <p>{t('privacy.sharing.body')}</p>
        <ul>
          <li>{t('privacy.sharing.whatsapp')}</li>
          <li>{t('privacy.sharing.email')}</li>
          <li>{t('privacy.sharing.maps')}</li>
          <li>{t('privacy.sharing.anthropic')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('privacy.rights.heading')}</h2>
        <p>{t('privacy.rights.body')}</p>
      </section>

      <section>
        <h2>{t('privacy.contact.heading')}</h2>
        <p>{t('privacy.contact.body')}</p>
      </section>
    </main>
  );
}
