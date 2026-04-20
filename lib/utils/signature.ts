import { createHmac, timingSafeEqual } from 'crypto';

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
