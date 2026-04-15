'use client';

import { useTranslations } from 'next-intl';

export function LoadingState() {
  const t = useTranslations('common');
  return (
    <div className="flex items-center justify-center p-8" role="status" aria-busy="true" aria-live="polite">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
      <span className="ml-2 text-sm text-muted">{t('loading')}</span>
    </div>
  );
}
