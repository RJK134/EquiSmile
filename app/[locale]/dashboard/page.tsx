import { useTranslations } from 'next-intl';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-sm text-muted">{t('subtitle')}</p>
          </div>

          <Card>
            <h2 className="text-lg font-semibold">{t('welcome')}</h2>
            <p className="mt-2 text-sm text-muted">{t('description')}</p>
          </Card>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <h3 className="text-sm font-medium text-muted">{t('quickStats')}</h3>
              <p className="mt-1 text-2xl font-bold">0</p>
            </Card>
            <Card>
              <h3 className="text-sm font-medium text-muted">{t('recentActivity')}</h3>
              <p className="mt-1 text-sm text-muted">{t('noActivity')}</p>
            </Card>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
