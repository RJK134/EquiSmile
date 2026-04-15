import { useTranslations } from 'next-intl';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';

export default function AppointmentsPage() {
  const t = useTranslations('appointments');

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted">{t('subtitle')}</p>
          </div>
          <Card>
            <p className="text-sm text-muted">{t('empty')}</p>
          </Card>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
