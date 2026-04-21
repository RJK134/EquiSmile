import { constantTimeEqualsUtf8 } from '@/lib/utils/constant-time';

export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export interface AllowlistSubject {
  githubLogin?: string | null;
  email?: string | null;
}

export function isAllowed(allowlist: string[], subject: AllowlistSubject): boolean {
  if (allowlist.length === 0) return false;
  const candidates = [subject.githubLogin, subject.email]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((value) => value.toLowerCase());
  return candidates.some((candidate) =>
    allowlist.some((entry) => constantTimeEqualsUtf8(entry, candidate)),
  );
}
