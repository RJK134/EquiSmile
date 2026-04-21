import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Constant-time string equality. `timingSafeEqual` requires equal-length
 * buffers; we gate on length first (acceptable leak for verify tokens).
 */
export function constantTimeStringEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Verify the WhatsApp webhook setup challenge. Meta sends `hub.verify_token`
 * during GET webhook verification; compare against the configured secret
 * in constant time so an attacker can't probe it character-by-character.
 */
export function verifyWhatsAppVerifyToken(
  received: string | null,
  expected: string | undefined,
): boolean {
  if (!received || !expected) return false;
  return constantTimeStringEquals(received, expected);
}

/**
 * Verify a Meta WhatsApp Cloud API webhook signature.
 * Meta sends the signature in the `X-Hub-Signature-256` header as `sha256=<hex>`.
 */
export function verifyWhatsAppSignature(
  payload: string | Buffer,
  signature: string,
  appSecret: string
): boolean {
  if (!signature || !appSecret) return false;

  const expectedSig =
    'sha256=' +
    createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');

  if (signature.length !== expectedSig.length) return false;

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
}

/**
 * Verify an n8n API key from the Authorization header.
 * Expected format: `Bearer <key>`
 */
export function verifyN8nApiKey(
  authHeader: string | null,
  expectedKey: string
): boolean {
  if (!authHeader || !expectedKey) return false;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false;

  const provided = parts[1];
  if (provided.length !== expectedKey.length) return false;

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expectedKey));
}

/**
 * Fail-closed n8n auth gate for route handlers.
 *
 * Historically the n8n routes accepted requests with NO Authorization
 * header whenever `N8N_API_KEY` was unset — convenient for local dev,
 * dangerous in production (the endpoints become anonymous send-email
 * / send-whatsapp / route-proposal sinks). This helper refuses the
 * request unless all of the following are true:
 *
 *  - `N8N_API_KEY` is configured, OR demo mode is on; AND
 *  - the request carries a matching `Bearer <key>` Authorization header
 *    (enforced whenever a key is configured).
 *
 * In demo mode we still gate on the key IF one is configured, but we
 * don't require one — demos run on a closed loopback by design.
 *
 * Return shape: `{ ok: true }` on success, or `{ ok: false, response }`
 * where `response` is a fully-formed `NextResponse` the caller can
 * return immediately.
 */
export interface N8nAuthContext {
  /** The value of the request's `authorization` header, if any. */
  authHeader: string | null;
  /** Configured API key (empty string / undefined means "not set"). */
  expectedKey: string | undefined;
  /** True if the app is running in demo mode (closed-loop). */
  demoMode: boolean;
}

export type N8nAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

export function requireN8nApiKey(ctx: N8nAuthContext): N8nAuthResult {
  const hasKey = typeof ctx.expectedKey === 'string' && ctx.expectedKey.length > 0;

  if (!hasKey) {
    if (ctx.demoMode) {
      // Closed-loop demo: accept anonymously. Still constant-time fine
      // because there's no comparison to leak.
      return { ok: true };
    }
    // Misconfigured production: FAIL CLOSED. Log once at error level so
    // operators notice — do not leak whether the header is present.
    console.error(
      '[n8n-auth] N8N_API_KEY is not configured; refusing n8n-authenticated request in production.',
    );
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Server misconfiguration: N8N_API_KEY is required' },
        { status: 500 },
      ),
    };
  }

  if (!verifyN8nApiKey(ctx.authHeader, ctx.expectedKey as string)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true };
}
