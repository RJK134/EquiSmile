'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const navItems = [
  { key: 'dashboard' as const, href: '/dashboard', icon: DashboardIcon },
  { key: 'enquiries' as const, href: '/enquiries', icon: EnquiriesIcon },
  { key: 'routeRuns' as const, href: '/route-runs', icon: RoutesIcon },
  { key: 'more' as const, href: '/customers', icon: MoreIcon },
];

export function MobileNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background md:hidden">
      <ul className="flex items-center justify-around">
        {navItems.map(({ key, href, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <li key={key}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
                  isActive ? 'text-primary' : 'text-muted hover:text-foreground'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon active={isActive} />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted'}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    </svg>
  );
}

function EnquiriesIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted'}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}

function RoutesIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted'}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
      />
    </svg>
  );
}

function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted'}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
      />
    </svg>
  );
}
