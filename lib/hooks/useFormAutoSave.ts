/**
 * Phase 7.3 — Form auto-save to localStorage.
 *
 * Saves form state to localStorage on change and restores it on page revisit.
 * Clears on successful submit.
 */

import { useEffect, useCallback, useRef } from 'react';

const STORAGE_PREFIX = 'equismile-form-';

export function useFormAutoSave<T>(
  formKey: string,
  currentValues: T,
  setValues: (values: T) => void,
): {
  clearSavedForm: () => void;
} {
  const storageKey = `${STORAGE_PREFIX}${formKey}`;
  const initializedRef = useRef(false);

  // Restore on mount — use ref to avoid setState in effect lint issue
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as T;
        // Defer to next microtask to avoid synchronous setState in effect
        queueMicrotask(() => setValues(parsed));
      }
    } catch {
      // Invalid stored data — ignore
    }
  }, [storageKey, setValues]);

  // Save on change (debounced via effect)
  useEffect(() => {
    if (!initializedRef.current) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(currentValues));
      } catch {
        // Storage full or unavailable — ignore
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [storageKey, currentValues]);

  const clearSavedForm = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { clearSavedForm };
}
