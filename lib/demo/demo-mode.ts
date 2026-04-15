/**
 * Phase 9 — Demo mode toggle.
 *
 * When DEMO_MODE=true, all external integrations return realistic mock
 * responses so the app can be demonstrated without real credentials.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _isDemoMode: boolean | null = null;

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
