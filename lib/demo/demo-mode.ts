/**
 * Phase 9 — Demo mode toggle.
 *
 * When DEMO_MODE=true, all external integrations return realistic mock
 * responses so the app can be demonstrated without real credentials.
 *
 * Per-integration override `EQUISMILE_LIVE_MAPS=true` forces the
 * Google Maps client to call the real API even while DEMO_MODE is
 * true, so a demo can show live geocoding + route optimisation while
 * keeping WhatsApp and email simulated.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _isDemoMode: boolean | null = null;
let _isLiveMapsForced: boolean | null = null;

export function isDemoMode(): boolean {
  if (_isDemoMode === null) {
    _isDemoMode = process.env.DEMO_MODE === 'true';
  }
  return _isDemoMode;
}

/**
 * Override for testing. Call with `undefined` to reset to env check.
 */
export function setDemoMode(value: boolean | undefined): void {
  _isDemoMode = value ?? null;
}

/**
 * Force live Google Maps even when DEMO_MODE is true. Used for client
 * demos that want a real geocode + Route Optimization API call.
 * Defaults to false; only the Maps client should consult this.
 * WhatsApp and email remain gated by `isDemoMode()` alone.
 */
export function isLiveMapsForced(): boolean {
  if (_isLiveMapsForced === null) {
    _isLiveMapsForced = process.env.EQUISMILE_LIVE_MAPS === 'true';
  }
  return _isLiveMapsForced;
}

/**
 * Override for testing. Call with `undefined` to reset to env check.
 */
export function setLiveMapsForced(value: boolean | undefined): void {
  _isLiveMapsForced = value ?? null;
}

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

export function demoLog(message: string, data?: Record<string, unknown>): void {
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[DEMO] ${message}${suffix}`);
}

// ---------------------------------------------------------------------------
// Guard for demo-only API routes
// ---------------------------------------------------------------------------

export function requireDemoMode(): { allowed: false; reason: string } | { allowed: true } {
  if (!isDemoMode()) {
    return { allowed: false, reason: 'Demo mode is not enabled. Set DEMO_MODE=true to use demo endpoints.' };
  }
  return { allowed: true };
}
