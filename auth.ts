import NextAuth, { type DefaultSession, type NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Nodemailer from 'next-auth/providers/nodemailer';
import { PrismaAdapter } from '@auth/prisma-adapter';

import { prisma } from '@/lib/prisma';
import { isAllowed, parseAllowlist } from '@/lib/auth/allowlist';
import { normaliseAppRole } from '@/lib/auth/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      githubLogin?: string | null;
      role?: string | null;
      staffId?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    githubLogin?: string | null;
    role?: string | null;
  }
}

function buildProviders(): NextAuthConfig['providers'] {
  const providers: NextAuthConfig['providers'] = [];

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
        profile(profile) {
          return {
            id: String(profile.id),
            name: profile.name ?? profile.login,
            email: profile.email,
            image: profile.avatar_url,
            githubLogin: profile.login,
            role: 'vet',
          };
        },
      }),
    );
  }

  const emailEnabled =
    process.env.AUTH_EMAIL_ENABLED === 'true' &&
    !!process.env.SMTP_HOST &&
    !!process.env.SMTP_USER &&
    !!process.env.SMTP_PASSWORD;

  if (emailEnabled) {
    providers.push(
      Nodemailer({
        server: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        },
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        maxAge: 15 * 60, // magic-link valid for 15 minutes
      }),
    );
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  providers: buildProviders(),
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === 'production',
  pages: {
    signIn: '/login',
    error: '/login',
    verifyRequest: '/login?verify=1',
  },
  callbacks: {
    async signIn({ user, profile, account }) {
      const allowlist = parseAllowlist(process.env.ALLOWED_GITHUB_LOGINS);
      const githubLogin =
        account?.provider === 'github'
          ? (profile as { login?: string } | undefined)?.login ?? user.githubLogin ?? null
          : user.githubLogin ?? null;
      return isAllowed(allowlist, { githubLogin, email: user.email });
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }

      try {
        const target = new URL(url);
        if (target.origin === baseUrl) {
          return target.toString();
        }
      } catch {
        return baseUrl;
      }

      return baseUrl;
    },
    async session({ session, user }) {
      if (session.user) {
        const staff = user.email
          ? await prisma.staff.findFirst({
              where: {
                active: true,
                OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
              },
              select: { id: true, role: true },
            })
          : await prisma.staff.findFirst({
              where: { active: true, userId: user.id },
              select: { id: true, role: true },
            });

        session.user.id = user.id;
        session.user.githubLogin = user.githubLogin ?? null;
        session.user.role = staff?.role ? normaliseAppRole(staff.role) : normaliseAppRole(user.role);
        session.user.staffId = staff?.id ?? null;
      }
      return session;
    },
  },
});
