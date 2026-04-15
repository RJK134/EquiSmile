import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

describe('i18n message files', () => {
  it('en.json and fr.json have the same top-level keys', () => {
    const enKeys = Object.keys(en).sort();
    const frKeys = Object.keys(fr).sort();
    expect(enKeys).toEqual(frKeys);
  });

  it('nav section has the same keys in both locales', () => {
    const enNavKeys = Object.keys(en.nav).sort();
    const frNavKeys = Object.keys(fr.nav).sort();
    expect(enNavKeys).toEqual(frNavKeys);
  });

  it('all top-level sections have matching keys', () => {
    for (const section of Object.keys(en) as (keyof typeof en)[]) {
      const enSection = en[section];
      const frSection = fr[section];
      if (typeof enSection === 'object' && enSection !== null) {
        const enSectionKeys = Object.keys(enSection).sort();
        const frSectionKeys = Object.keys(frSection as Record<string, unknown>).sort();
        expect(enSectionKeys).toEqual(frSectionKeys);
      }
    }
  });
});
