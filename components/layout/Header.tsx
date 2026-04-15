'use client';

import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Header() {
  const t = useTranslations('app');

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-primary">{t('name')}</span>
        <span className="hidden text-sm text-muted sm:inline">{t('tagline')}</span>
      </div>
      <LanguageSwitcher />
    </header>
  );
}
