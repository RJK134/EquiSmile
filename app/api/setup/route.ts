import { NextResponse } from 'next/server';

/**
 * GET /api/setup — REMOVED (Phase 16, seventh slice).
 *
 * This route used to invoke `execSync('npx prisma migrate deploy')`
 * and `execSync('npx tsx prisma/seed-demo.ts')` from an HTTP handler.
 * That was a security smell:
 *
 *   1. Spawning child processes from an HTTP handler is a code-
 *      execution path the moment the gate ever weakens.
 *   2. `execSync` blocks the Node event loop for the full duration
 *      of the migration / seed, starving every other in-flight
 *      request and any background timers.
 *   3. Error handling worked off raw `stderr` text, which can carry
 *      DB credentials in failure modes.
 *
 * The compose stack already runs migrations correctly via the
 * `migrator` service — it executes `npx prisma migrate deploy`
 * and (when `DEMO_MODE=true`) the demo seed before the `app`
 * service boots. So this route was both unsafe and duplicative.
 *
 * The handler now returns a stable 410 Gone with operator guidance
 * pointing at the supported paths. The `DEMO_MODE` gate is retained
 * as defence-in-depth — production deploys still get a 403 if they
 * somehow probe this route.
 */
export async function GET() {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json(
      {
        error: 'Not available in production',
        hint: 'DEMO_MODE-only endpoint',
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      status: 'gone',
      removedIn: 'phase-16/setup-execsync',
      message:
        '/api/setup no longer runs migrations from an HTTP handler. ' +
        'Use one of the supported paths below.',
      supportedPaths: {
        compose:
          'docker compose up migrator (runs `prisma migrate deploy` + demo seed when DEMO_MODE=true).',
        local:
          'npx prisma migrate deploy && npx tsx prisma/seed-demo.ts',
        docs: 'See docs/SETUP.md and docs/DEPLOYMENT.md.',
      },
    },
    {
      status: 410,
      headers: {
        // Standard HTTP response for a permanently-removed resource.
        // Operators tailing logs can grep for `410 /api/setup` to
        // catch any caller still hitting the dead URL.
        'Cache-Control': 'no-store',
      },
    },
  );
}
