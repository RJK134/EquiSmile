/**
 * POST /api/demo/sign-in — one-click sign-in for demo mode.
 *
 * Supports persona selection via the `persona` form field. When a
 * persona email is submitted, signs in as that seeded User. Falls
 * back to the default "Demo Vet" admin persona.
 *
 * Hard-blocked outside DEMO_MODE so this can never become a real
 * sign-in bypass on a live deployment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { routing } from '@/i18n/routing';

const DEFAULT_EMAIL = 'rachel@equismile.demo';
const DEFAULT_NAME = 'Dr. Rachel Kemp';
const DEFAULT_LOGIN = 'rachel-kemp';
const SESSION_DAYS = 30;

const DEMO_PERSONAS: Record<string, { name: string; login: string; role: string }> = {
  'rachel@equismile.demo': { name: 'Dr. Rachel Kemp', login: 'rachel-kemp', role: 'admin' },
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
  const personaEmail = typeof submittedPersona === 'string' && submittedPersona in DEMO_PERSONAS
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

  const response = NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url), 303);
  response.cookies.set('authjs.session-token', sessionToken, {
    expires,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
