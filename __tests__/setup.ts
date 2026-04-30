/**
 * Vitest global setup.
 *
 * `lib/env.ts` validates `process.env` at module-load time (Zod
 * `.min(1)` on `DATABASE_URL`) and throws when the var is missing.
 * Routes that import `@/lib/env` therefore fail at *import* time
 * before any test body runs, so the failure shows up as 7+ test
 * crashes rather than "test asserted X but got Y".
 *
 * CI sets `DATABASE_URL` to a stub in `.github/workflows/ci.yml`.
 * Local dev usually doesn't have a `.env`. Set the same stub here so
 * the test runner behaves identically in both environments.
 *
 * `??=` means a real `DATABASE_URL` exported in the shell still wins —
 * exactly the shape CI relies on. The stub points at a host that is
 * intentionally not a real DB; any test that *forgets* to mock
 * `@/lib/prisma` will fail with a connection error rather than
 * silently flip rows in a developer's working DB.
 */
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
