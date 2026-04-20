'use client';

import { signOut, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

export function UserMenu() {
  const { data: session } = useSession();
  const t = useTranslations('auth');

  if (!session?.user) return null;

  const label = session.user.githubLogin || session.user.name || session.user.email || '';

  return (
    <div className="flex items-center gap-2 text-sm">
      {session.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.user.image}
          alt=""
          className="h-7 w-7 rounded-full border border-gray-200"
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-700">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="hidden text-gray-800 sm:inline" title={label}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="ml-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
      >
        {t('signOut')}
      </button>
    </div>
  );
}
