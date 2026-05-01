'use client';

import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './LanguageSwitcher';
import { UserMenu } from '@/components/auth/UserMenu';
import { Logo } from '@/components/branding/Logo';

export function Header() {
  const t = useTranslations('app');

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Logo size={28} variant="nav" />
        <span className="hidden text-sm text-muted sm:inline">{t('tagline')}</span>
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}
