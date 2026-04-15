'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LanguageSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('label')}>
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleChange(loc)}
          disabled={loc === locale}
          className={`min-h-[44px] min-w-[44px] rounded px-3 py-2 text-sm font-medium transition-colors ${
            loc === locale
              ? 'bg-primary text-white'
              : 'text-muted hover:bg-border hover:text-foreground'
          }`}
          aria-current={loc === locale ? 'true' : undefined}
        >
          {t(loc)}
        </button>
      ))}
    </div>
  );
}
