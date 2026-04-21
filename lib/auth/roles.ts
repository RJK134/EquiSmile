export const APP_ROLES = ['admin', 'vet', 'nurse'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function normaliseAppRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;
  const normalised = role.trim().toLowerCase();
  if (APP_ROLES.includes(normalised as AppRole)) {
    return normalised as AppRole;
  }
  return null;
}
