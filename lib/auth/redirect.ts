/**
 * Open-redirect protection for `callbackUrl`-style parameters.
 *
 * Auth.js, OAuth providers, and our own login page all accept a
 * caller-supplied URL to return to after sign-in. Naïvely trusting that
 * value lets an attacker craft links like:
 *
 *     /login?callbackUrl=https://evil.example/
 *
 * and have the app redirect the user's browser off-site, enabling
 * phishing (the evil site loads with the user's expectation of being on
 * EquiSmile). We mitigate by only allowing safe **same-origin,
 * root-relative** paths.
 *
 * Rules, all applied in order:
 *
 *  1. Decode once (catches `%2F%2Fevil` → `//evil`).
 *  2. Must begin with exactly one `/` — rejects absolute URLs.
 *  3. Must NOT begin with `//` or `\\` — rejects protocol-relative.
 *  4. Must NOT contain `\n`, `\r`, or a colon before the first `/`.
 *  5. Must NOT traverse outside the app via `..`.
 *
 * Anything not matching falls back to `/` (root of the app).
 *
 * NOTE: callers should ALWAYS route untrusted URLs through
 * `safeCallbackUrl` before handing them to `redirect()` or
 * `NextResponse.redirect()`.
 */

const MAX_LENGTH = 2048;

export function isSafeCallbackUrl(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string' || raw.length === 0) return false;
  if (raw.length > MAX_LENGTH) return false;

  // CR/LF/NUL cannot appear in a safe path.
  if (/[\r\n\u0000]/.test(raw)) return false;

  // Decode ONCE. If decoding throws, refuse.
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return false;
  }

  if (/[\r\n\u0000]/.test(decoded)) return false;

  // Must start with "/" and NOT be protocol-relative ("//" or "/\").
  if (!decoded.startsWith('/')) return false;
  if (decoded.startsWith('//') || decoded.startsWith('/\\')) return false;
  if (decoded.startsWith('/\t') || decoded.startsWith('/ ')) return false;

  // No scheme (colon before the first slash of the path segment).
  // Anything like "/javascript:..." decoded could still be treated as
  // a scheme URL by some clients; disallow.
  const firstSlash = decoded.indexOf('/', 1);
  const firstColon = decoded.indexOf(':');
  if (firstColon !== -1 && (firstSlash === -1 || firstColon < firstSlash)) {
    return false;
  }

  // Reject naive path traversal. We're not looking at the FS, but a
  // callbackUrl of "/../../admin" is suspicious and there's no
  // legitimate use case for `..` in this app's routes.
  if (decoded.split(/[/\\]/).some((segment) => segment === '..')) return false;

  return true;
}

/**
 * Return `raw` if it's a safe callback URL; otherwise `fallback`.
 */
export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback: string = '/',
): string {
  return isSafeCallbackUrl(raw) ? (raw as string) : fallback;
}
