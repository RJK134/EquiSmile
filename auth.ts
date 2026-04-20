import NextAuth, { type DefaultSession } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';

import { prisma } from '@/lib/prisma';
import { isAllowed, parseAllowlist } from '@/lib/auth/allowlist';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      githubLogin?: string | null;
      role?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    githubLogin?: string | null;
    role?: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  providers: [
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
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, profile }) {
      const allowlist = parseAllowlist(process.env.ALLOWED_GITHUB_LOGINS);
      const githubLogin =
        (profile as { login?: string } | undefined)?.login ?? user.githubLogin ?? null;
      return isAllowed(allowlist, { githubLogin, email: user.email });
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.githubLogin = user.githubLogin ?? null;
        session.user.role = user.role ?? null;
      }
      return session;
    },
  },
});
