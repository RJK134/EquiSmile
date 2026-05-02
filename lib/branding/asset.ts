/**
 * Branding asset helpers for non-HTML render contexts (PDF, Excel,
 * email). The web nav uses `components/branding/Logo.tsx` directly;
 * those contexts can't host a React component, so this module exposes
 * the same single-source-of-truth path through Node fs.
 *
 * The placeholder path is `public/logo.png` (raster) — when the real
 * brand asset is delivered, drop it at that path and every PDF /
 * Excel / email caller picks it up automatically. Until then, callers
 * receive `null` and fall back to a styled-text wordmark so the
 * artefact still ships a recognisable EquiSmile heading.
 *
 * Why PNG and not the SVG already in public/?
 *   - PDFKit's image() supports PNG/JPG only — no SVG path parser.
 *   - ExcelJS workbook.addImage requires PNG/JPG/GIF.
 *   Asking each caller to decode the SVG would multiply complexity;
 *   shipping a PNG sibling keeps every consumer trivial.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOGO_PATH = join(process.cwd(), 'public', 'logo.png');

let cached: { buffer: Buffer | null; checked: boolean } = {
  buffer: null,
  checked: false,
};

/**
 * Returns the binary contents of `public/logo.png` once available, or
 * null while the placeholder text-wordmark is in use. Cached on first
 * read so a long-running server doesn't re-stat per render.
 */
export function loadLogoPng(): Buffer | null {
  if (cached.checked) return cached.buffer;
  cached = { buffer: null, checked: true };
  if (existsSync(LOGO_PATH)) {
    try {
      cached.buffer = readFileSync(LOGO_PATH);
    } catch {
      cached.buffer = null;
    }
  }
  return cached.buffer;
}

/** Test-only — clears the singleton so unit tests can re-stat. */
export function _resetLogoCacheForTests(): void {
  cached = { buffer: null, checked: false };
}

export const BRAND_NAME = 'EquiSmile';
export const BRAND_PRIMARY_HEX = '9b214d'; // ExcelJS expects ARGB without #; PDFKit accepts #-prefixed
