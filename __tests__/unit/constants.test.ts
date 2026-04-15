import { describe, it, expect } from 'vitest';
import { LOCALES, DEFAULT_LOCALE, APP_NAME, URGENT_KEYWORDS } from '@/lib/constants';

describe('constants', () => {
  it('defines supported locales', () => {
    expect(LOCALES).toContain('en');
    expect(LOCALES).toContain('fr');
  });

  it('has English as the default locale', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('defines the app name', () => {
    expect(APP_NAME).toBe('EquiSmile');
  });

  it('includes expected urgent keywords', () => {
    expect(URGENT_KEYWORDS).toContain('pain');
    expect(URGENT_KEYWORDS).toContain('bleeding');
    expect(URGENT_KEYWORDS).toContain('not eating');
  });
});
