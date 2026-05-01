/**
 * POST /api/demo/sign-in — one-click sign-in for demo mode.
 *
 * The app is built for production with GitHub OAuth or email magic-
 * link auth. Neither is configured in a fresh demo environment, so
 * the login page renders a card with no buttons — there is no way
 * to get past the auth wall to see the seeded data.
 *
 * This endpoint exists ONLY when DEMO_MODE=true. It upserts a
 * single "Demo Vet" User row, mints a Prisma-adapter Session, sets
 * the Auth.js session cookie, and returns 200 OK + JSON with the
 * post-sign-in `redirectTo` for the client to navigate to.
 *
 * Returns 200 + JSON instead of a 303 redirect so browser-automation
 * tools that misreport 3xx responses (the Perplexity tool reported
 * the 303 as 503 in round-1 and round-2 UAT) cannot cause a
 * false-alarm "sign-in failed" perception.
 *
 * Hard-blocked outside demo mode so this can never become a real
 * sign-in bypass on a live deployment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { routing } from '@/i18n/routing';

const DEMO_USER_EMAIL = 'demo-vet@equismile.local';
const DEMO_USER_NAME = 'Demo Vet';
const DEMO_USER_LOGIN = 'demo-vet';
const SESSION_DAYS = 30;

/**
 * Allow-list the form-supplied locale against the configured set so
 * a crafted POST cannot redirect to an arbitrary path. Falls back to
 * the project default when the value is missing or unknown.
 */
function resolveLocale(submitted: string | null): string {
  const known: readonly string[] = routing.locales;
  if (submitted && known.includes(submitted)) return submitted;
  return routing.defaultLocale;
}

export async function POST(request: NextRequest) {
  if (env.DEMO_MODE !== 'true') {
    return NextResponse.json(
      { error: 'Demo sign-in is disabled outside DEMO_MODE.' },
      { status: 404 },
    );
  }

  // Resolve the post-sign-in locale from the form payload so French
  // users land on /fr/dashboard, English on /en/dashboard. Whitelisted
  // against `routing.locales` so a crafted body cannot redirect off-
  // origin.
  const formData = await request.formData().catch(() => null);
  const submittedLocale = formData?.get('locale');
  const locale = resolveLocale(typeof submittedLocale === 'string' ? submittedLocale : null);

  // 1. Find or create the demo operator. Granted `admin` so the
  //    persona test can exercise every privileged route. The
  //    githubLogin makes the AuthenticatedSubject.actorLabel
  //    consistent in audit rows.
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    create: {
      email: DEMO_USER_EMAIL,
      name: DEMO_USER_NAME,
      githubLogin: DEMO_USER_LOGIN,
      role: 'admin',
    },
    update: {},
  });

  // 2. Mint a Prisma-adapter session row. Auth.js reads
  //    `Session.sessionToken` to resolve the current user — we just
  //    have to create the row and set the matching cookie.
  const sessionToken = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  });

  // 3. Set the Auth.js session cookie and return 200 + JSON. Cookie
  //    name matches what auth.ts configures for non-production:
  //    `authjs.session-token`. In demo mode IS_PRODUCTION is forced
  //    false (see auth.ts), so the unprefixed name is correct. The
  //    client reads `redirectTo` and calls router.push on it.
  const response = NextResponse.json(
    { ok: true, redirectTo: `/${locale}/dashboard` },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, private',
      },
    },
  );
  response.cookies.set('authjs.session-token', sessionToken, {
    expires,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
