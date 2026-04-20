import { redirect } from 'next/navigation';

import { auth } from '@/auth';

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser(redirectTo: string = '/login') {
  const user = await getCurrentUser();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}

export function performedByFor(user: { githubLogin?: string | null; email?: string | null; id?: string } | null): string {
  if (!user) return 'system';
  return user.githubLogin || user.email || user.id || 'system';
}
