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
  hasSavedData: boolean;
} {
  const storageKey = `${STORAGE_PREFIX}${formKey}`;
  const hasSavedData = useRef(false);
  const initialized = useRef(false);

  // Restore on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as T;
        setValues(parsed);
        hasSavedData.current = true;
      }
    } catch {
      // Invalid stored data — ignore
    }
  }, [storageKey, setValues]);

  // Save on change (debounced via effect)
  useEffect(() => {
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

  return { clearSavedForm, hasSavedData: hasSavedData.current };
}
