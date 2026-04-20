import NextAuth, { type DefaultSession, type NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Nodemailer from 'next-auth/providers/nodemailer';
import { PrismaAdapter } from '@auth/prisma-adapter';

import { prisma } from '@/lib/prisma';
import { isAllowed, parseAllowlist } from '@/lib/auth/allowlist';
import { safeCallbackUrl } from '@/lib/auth/redirect';

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

const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true';

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

/**
 * Secure cookie configuration. In production we set `__Secure-` prefix
 * + Secure flag + HttpOnly + SameSite=Lax on all session/CSRF cookies.
 *
 * SameSite=Lax is the right trade-off for OAuth: it lets the user come
 * back from GitHub/magic-link clicks (top-level navigations) while still
 * blocking cross-site POST-style CSRF. Strict would break OAuth callbacks.
 */
const SECURE_COOKIES: NextAuthConfig['cookies'] = IS_PRODUCTION
  ? {
      sessionToken: {
        name: '__Secure-authjs.session-token',
        options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
      },
      callbackUrl: {
        name: '__Secure-authjs.callback-url',
        options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
      },
      csrfToken: {
        name: '__Host-authjs.csrf-token',
        options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
      },
      pkceCodeVerifier: {
        name: '__Secure-authjs.pkce.code_verifier',
        options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 60 * 15 },
      },
      state: {
        name: '__Secure-authjs.state',
        options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 60 * 15 },
      },
      nonce: {
        name: '__Secure-authjs.nonce',
        options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
      },
    }
  : undefined;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'database',
    // 30-day absolute lifetime, 24-hour rotation window.
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  // Trust the `AUTH_URL` host explicitly — required when the app sits
  // behind a reverse proxy (Caddy, nginx) so Auth.js constructs the
  // correct callback origin instead of guessing from the Host header.
  trustHost: Boolean(process.env.AUTH_URL),
  useSecureCookies: IS_PRODUCTION,
  cookies: SECURE_COOKIES,
  providers: buildProviders(),
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
      const allowed = isAllowed(allowlist, { githubLogin, email: user.email });
      if (!allowed) {
        // Deliberately generic log — no user identifiers in production.
        console.warn('[auth] sign-in denied by allow-list', {
          provider: account?.provider ?? 'unknown',
        });
      }
      return allowed;
    },
    /**
     * Open-redirect defence. Auth.js calls `redirect` every time it
     * builds a post-sign-in redirect URL. We allow only:
     *  - URLs on the app's own origin (same `baseUrl`)
     *  - Same-origin relative paths
     * Any other value (including an evil absolute URL slipped via
     * `callbackUrl`) is silently replaced with the app root.
     */
    async redirect({ url, baseUrl }) {
      try {
        if (url.startsWith('/')) {
          return safeCallbackUrl(url, '/') === url ? `${baseUrl}${url}` : baseUrl;
        }
        const parsed = new URL(url);
        const base = new URL(baseUrl);
        if (parsed.origin === base.origin) return parsed.toString();
      } catch {
        // fall through
      }
      return baseUrl;
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
