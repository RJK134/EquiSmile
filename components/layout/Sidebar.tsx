'use client';

import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Link, usePathname } from '@/i18n/navigation';

const sidebarItems = [
  { key: 'dashboard' as const, href: '/dashboard' },
  { key: 'enquiries' as const, href: '/enquiries' },
  { key: 'customers' as const, href: '/customers' },
  { key: 'yards' as const, href: '/yards' },
  { key: 'horses' as const, href: '/horses' },
  { key: 'planning' as const, href: '/planning' },
  { key: 'visitRequests' as const, href: '/visit-requests' },
  { key: 'routeRuns' as const, href: '/route-runs' },
  { key: 'appointments' as const, href: '/appointments' },
  { key: 'completed' as const, href: '/completed' },
  { key: 'staff' as const, href: '/staff' },
];

const adminItems = [
  // Phase 16 — admin-only observability dashboard (DLQ + backup +
  // audit). Hidden from lower-privilege sessions because the page
  // itself returns 403 for them.
  { key: 'observability' as const, href: '/admin/observability' },
];

export function Sidebar() {
  const t = useTranslations('nav');
  const { data: session } = useSession();
  const pathname = usePathname();

  const isAdmin = session?.user?.role === 'admin';

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-background lg:block">
      <nav aria-label="Main navigation" className="flex flex-col gap-1 p-3">
        {sidebarItems.map(({ key, href }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={key}
              href={href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-surface hover:text-foreground'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {t(key)}
            </Link>
          );
        })}
        {isAdmin && (
          <>
            <hr className="my-2 border-border" />
            {adminItems.map(({ key, href }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={key}
                  href={href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted hover:bg-surface hover:text-foreground'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {t(key)}
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
