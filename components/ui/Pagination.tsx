'use client';

import { useTranslations } from 'next-intl';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const t = useTranslations('common');

  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={t('previous')}
      >
        {t('previous')}
      </button>
      <span className="text-sm text-muted" aria-current="page">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={t('next')}
      >
        {t('next')}
      </button>
    </nav>
  );
}
