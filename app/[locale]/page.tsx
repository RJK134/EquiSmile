import { redirect } from '@/i18n/navigation';

export default function LocaleRoot() {
  redirect({ href: '/dashboard', locale: 'en' });
}
