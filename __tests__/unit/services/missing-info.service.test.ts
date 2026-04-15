import { describe, it, expect } from 'vitest';
import {
  checkCompleteness,
  generateFollowUpMessage,
} from '@/lib/services/missing-info.service';

describe('missing-info.service', () => {
  describe('checkCompleteness', () => {
    it('detects missing postcode when no yard', () => {
      const result = checkCompleteness({
        yardId: null,
        horseCount: 2,
        preferredDays: ['mon'],
        customer: { mobilePhone: '07123456789', email: null },
        yard: null,
      });
      expect(result.some(f => f.field === 'postcode')).toBe(true);
    });

    it('does not flag postcode when yard exists', () => {
      const result = checkCompleteness({
        yardId: 'yard-1',
        horseCount: 2,
        preferredDays: ['mon'],
        customer: { mobilePhone: '07123456789', email: null },
        yard: { postcode: 'BA1 1AA' },
      });
      expect(result.some(f => f.field === 'postcode')).toBe(false);
    });

    it('detects missing horse count', () => {
      const result = checkCompleteness({
        yardId: 'yard-1',
        horseCount: null,
        preferredDays: ['mon'],
        customer: { mobilePhone: '07123456789', email: null },
        yard: { postcode: 'BA1 1AA' },
      });
      expect(result.some(f => f.field === 'horseCount')).toBe(true);
    });

    it('detects missing preferred days', () => {
      const result = checkCompleteness({
        yardId: 'yard-1',
        horseCount: 2,
        preferredDays: [],
        customer: { mobilePhone: '07123456789', email: null },
        yard: { postcode: 'BA1 1AA' },
      });
      expect(result.some(f => f.field === 'preferredDays')).toBe(true);
    });

    it('detects missing contact info', () => {
      const result = checkCompleteness({
        yardId: 'yard-1',
        horseCount: 2,
        preferredDays: ['mon'],
        customer: { mobilePhone: null, email: null },
        yard: { postcode: 'BA1 1AA' },
      });
      expect(result.some(f => f.field === 'contact')).toBe(true);
    });

    it('returns empty for complete request', () => {
      const result = checkCompleteness({
        yardId: 'yard-1',
        horseCount: 2,
        preferredDays: ['mon', 'wed'],
        customer: { mobilePhone: '07123456789', email: 'test@test.com' },
        yard: { postcode: 'BA1 1AA' },
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('generateFollowUpMessage', () => {
    const missingFields = [
      { field: 'postcode', label_en: 'the postcode or address of your yard', label_fr: "le code postal ou l'adresse de votre écurie" },
      { field: 'horseCount', label_en: 'how many horses need treatment', label_fr: 'combien de chevaux nécessitent un traitement' },
    ];

    it('generates EN message', () => {
      const msg = generateFollowUpMessage('John', missingFields, 'en');
      expect(msg).toContain('Hi John');
      expect(msg).toContain('thanks for your enquiry');
      expect(msg).toContain('postcode or address');
      expect(msg).toContain('how many horses');
      expect(msg).toContain('EquiSmile');
    });

    it('generates FR message', () => {
      const msg = generateFollowUpMessage('Marie', missingFields, 'fr');
      expect(msg).toContain('Bonjour Marie');
      expect(msg).toContain('merci pour votre demande');
      expect(msg).toContain('code postal');
      expect(msg).toContain('combien de chevaux');
      expect(msg).toContain('EquiSmile');
    });

    it('generates EN reminder message', () => {
      const msg = generateFollowUpMessage('John', missingFields, 'en', true);
      expect(msg).toContain('gentle reminder');
      expect(msg).not.toContain('thanks for your enquiry');
    });

    it('generates FR reminder message', () => {
      const msg = generateFollowUpMessage('Marie', missingFields, 'fr', true);
      expect(msg).toContain('relancer');
      expect(msg).not.toContain('merci pour votre demande');
    });
  });
});
