import { auth } from '@/auth';
import { type AppRole, normaliseAppRole } from '@/lib/auth/roles';
import { ApiError } from '@/lib/http-errors';
import { prisma } from '@/lib/prisma';

export interface AuthenticatedActor {
  userId: string;
  staffId: string | null;
  role: AppRole;
  email: string | null;
  githubLogin: string | null;
  performedBy: string;
}

export async function getAuthenticatedActor(): Promise<AuthenticatedActor> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError(401, 'Authentication required');
  }

  const email = session.user.email?.trim().toLowerCase() ?? null;
  const githubLogin = session.user.githubLogin?.trim() ?? null;

  const staff = await prisma.staff.findFirst({
    where: {
      active: true,
      OR: [
        { userId: session.user.id },
        ...(email ? [{ email }] : []),
      ],
    },
    select: {
      id: true,
      role: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const role = normaliseAppRole(staff?.role ?? session.user.role) ?? 'vet';

  return {
    userId: session.user.id,
    staffId: staff?.id ?? null,
    role,
    email,
    githubLogin,
    performedBy: githubLogin || email || session.user.id,
  };
}

export async function requireActorWithRole(allowedRoles: readonly AppRole[]): Promise<AuthenticatedActor> {
  const actor = await getAuthenticatedActor();
  if (!allowedRoles.includes(actor.role)) {
    throw new ApiError(403, 'Forbidden');
  }
  return actor;
}

export async function requireAuthenticatedActor(): Promise<AuthenticatedActor> {
  return getAuthenticatedActor();
}

export async function requireActorWithStaffRole(allowedRoles: readonly AppRole[]): Promise<AuthenticatedActor> {
  const actor = await requireActorWithRole(allowedRoles);
  if (!actor.staffId) {
    throw new ApiError(403, 'Active staff link required');
  }
  return actor;
}
