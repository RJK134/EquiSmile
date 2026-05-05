/**
 * POST /api/demo/sign-in — one-click sign-in for demo mode.
 *
 * Supports persona selection via the `persona` form field. When a
 * persona email is submitted, signs in as that seeded User. Falls
 * back to the default admin persona.
 *
 * This endpoint exists ONLY when DEMO_MODE=true. It upserts the
 * selected persona User row, mints a Prisma-adapter Session, sets
 * the Auth.js session cookie, and returns 200 OK + JSON with the
 * post-sign-in `redirectTo` for the client to navigate to.
 *
 * Returns 200 + JSON instead of a 303 redirect so automation
 * tooling that misclassifies 3xx responses does not create a false
 * "sign-in failed" signal.
 *
 * Hard-blocked outside demo mode so this can never become a real
 * sign-in bypass on a live deployment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { routing } from '@/i18n/routing';

const DEFAULT_EMAIL = 'kathelijne@equismile.demo';
const DEFAULT_NAME = 'Dr. Kathelijne Deberdt';
const DEFAULT_LOGIN = 'kathelijne-deberdt';
const SESSION_DAYS = 30;

const DEMO_PERSONAS: Record<string, { name: string; login: string; role: string }> = {
  'kathelijne@equismile.demo': { name: 'Dr. Kathelijne Deberdt', login: 'kathelijne-deberdt', role: 'admin' },
  'alex@equismile.demo': { name: 'Dr. Alex Moreau', login: 'alex-moreau', role: 'vet' },
  'sophie@equismile.demo': { name: 'Dr. Sophie Laurent', login: 'sophie-laurent', role: 'vet' },
  'lea@equismile.demo': { name: 'Léa Bertrand', login: 'lea-bertrand', role: 'nurse' },
  'marc@equismile.demo': { name: 'Marc Dubois', login: 'marc-dubois', role: 'readonly' },
};

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

  const formData = await request.formData().catch(() => null);
  const submittedLocale = formData?.get('locale');
  const locale = resolveLocale(typeof submittedLocale === 'string' ? submittedLocale : null);

  const submittedPersona = formData?.get('persona');
  const personaEmail =
    typeof submittedPersona === 'string' && Object.hasOwn(DEMO_PERSONAS, submittedPersona)
      ? submittedPersona
      : DEFAULT_EMAIL;
  const persona = DEMO_PERSONAS[personaEmail] ?? { name: DEFAULT_NAME, login: DEFAULT_LOGIN, role: 'admin' };

  const user = await prisma.user.upsert({
    where: { email: personaEmail },
    create: {
      email: personaEmail,
      name: persona.name,
      githubLogin: persona.login,
      role: persona.role,
    },
    update: {},
  });

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
    // Mark Secure on Vercel (always HTTPS) but keep working over plain
    // HTTP on `localhost` in dev. Defence-in-depth: the route is already
    // hard-blocked outside DEMO_MODE, but a Secure cookie cannot be
    // exfiltrated over an accidentally-served HTTP response.
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
