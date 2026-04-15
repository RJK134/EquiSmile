import { describe, it, expect } from 'vitest';
import {
  classifyUrgency,
  classifyRequestType,
  detectMissingFields,
  estimateDuration,
  runTriageRules,
} from '@/lib/services/triage-rules.service';

describe('triage-rules.service', () => {
  // -----------------------------------------------------------------------
  // classifyUrgency
  // -----------------------------------------------------------------------
  describe('classifyUrgency', () => {
    it('classifies EN urgent keywords', () => {
      expect(classifyUrgency('My horse is in pain').urgency).toBe('URGENT');
      expect(classifyUrgency('Horse bleeding from mouth').urgency).toBe('URGENT');
      expect(classifyUrgency("Can't eat properly").urgency).toBe('URGENT');
      expect(classifyUrgency('Severe swelling in jaw').urgency).toBe('URGENT');
      expect(classifyUrgency("Horse won't eat and losing weight").urgency).toBe('URGENT');
      expect(classifyUrgency('Emergency dental needed').urgency).toBe('URGENT');
      expect(classifyUrgency('Abscess on jaw area').urgency).toBe('URGENT');
      expect(classifyUrgency('Horse is quidding badly').urgency).toBe('URGENT');
      expect(classifyUrgency('Acute distress after eating').urgency).toBe('URGENT');
      expect(classifyUrgency('Blood coming from mouth').urgency).toBe('URGENT');
      expect(classifyUrgency('Weight loss over past weeks').urgency).toBe('URGENT');
      expect(classifyUrgency('Unable to eat hay').urgency).toBe('URGENT');
      expect(classifyUrgency('Not eating at all').urgency).toBe('URGENT');
      expect(classifyUrgency('Lame jaw movement').urgency).toBe('URGENT');
    });

    it('classifies FR urgent keywords', () => {
      expect(classifyUrgency('Mon cheval a une douleur').urgency).toBe('URGENT');
      expect(classifyUrgency('Il ne mange pas').urgency).toBe('URGENT');
      expect(classifyUrgency('Gonflement visible').urgency).toBe('URGENT');
      expect(classifyUrgency('Saignement de la bouche').urgency).toBe('URGENT');
      expect(classifyUrgency('Sang dans la salive').urgency).toBe('URGENT');
      expect(classifyUrgency('Urgence dentaire').urgency).toBe('URGENT');
      expect(classifyUrgency('Cheval en détresse').urgency).toBe('URGENT');
      expect(classifyUrgency('Perte de poids importante').urgency).toBe('URGENT');
      expect(classifyUrgency('Abcès sous la mâchoire').urgency).toBe('URGENT');
    });

    it('classifies EN soon keywords', () => {
      expect(classifyUrgency('Horse is overdue for dental').urgency).toBe('SOON');
      expect(classifyUrgency('Need a follow-up appointment').urgency).toBe('SOON');
      expect(classifyUrgency('Mild symptoms noticed').urgency).toBe('SOON');
      expect(classifyUrgency("I'm concerned about teeth").urgency).toBe('SOON');
      expect(classifyUrgency("I'm worried about my horse").urgency).toBe('SOON');
      expect(classifyUrgency("Horse not right lately").urgency).toBe('SOON');
      expect(classifyUrgency('Horse behaving oddly when eating').urgency).toBe('SOON');
      expect(classifyUrgency('Due for check this month').urgency).toBe('SOON');
    });

    it('classifies FR soon keywords', () => {
      expect(classifyUrgency('Le contrôle prévu est en retard').urgency).toBe('SOON');
      expect(classifyUrgency('Suivi nécessaire').urgency).toBe('SOON');
      expect(classifyUrgency('Je suis inquiet pour mon cheval').urgency).toBe('SOON');
      expect(classifyUrgency("Ce n'est pas normal pour lui").urgency).toBe('SOON');
    });

    it('classifies routine messages', () => {
      expect(classifyUrgency('I would like a routine check-up').urgency).toBe('ROUTINE');
      expect(classifyUrgency('Annual dental please').urgency).toBe('ROUTINE');
      expect(classifyUrgency('Book us in when available').urgency).toBe('ROUTINE');
      expect(classifyUrgency('Just a standard dental check').urgency).toBe('ROUTINE');
      expect(classifyUrgency('Hello there').urgency).toBe('ROUTINE');
    });

    it('classifies FR routine messages', () => {
      expect(classifyUrgency('Contrôle dentaire de routine').urgency).toBe('ROUTINE');
      expect(classifyUrgency('Examen annuel svp').urgency).toBe('ROUTINE');
      expect(classifyUrgency('Quand vous êtes disponible').urgency).toBe('ROUTINE');
    });

    it('returns matched keywords', () => {
      const result = classifyUrgency('Horse in pain and bleeding');
      expect(result.matchedKeywords).toContain('pain');
      expect(result.matchedKeywords).toContain('bleeding');
    });

    it('handles empty text', () => {
      const result = classifyUrgency('');
      expect(result.urgency).toBe('ROUTINE');
      expect(result.matchedKeywords).toHaveLength(0);
    });

    it('is case insensitive', () => {
      expect(classifyUrgency('PAIN IN JAW').urgency).toBe('URGENT');
      expect(classifyUrgency('URGENT dental needed').urgency).toBe('URGENT');
    });

    it('urgent takes priority over soon', () => {
      expect(classifyUrgency('Overdue check, horse in pain').urgency).toBe('URGENT');
    });
  });

  // -----------------------------------------------------------------------
  // classifyRequestType
  // -----------------------------------------------------------------------
  describe('classifyRequestType', () => {
    it('returns URGENT_ISSUE when urgency is URGENT', () => {
      expect(classifyRequestType('routine dental', 'URGENT')).toBe('URGENT_ISSUE');
    });

    it('detects FOLLOW_UP', () => {
      expect(classifyRequestType('Need a follow-up after last visit', 'ROUTINE')).toBe('FOLLOW_UP');
      expect(classifyRequestType('Recheck appointment needed', 'ROUTINE')).toBe('FOLLOW_UP');
      expect(classifyRequestType('After last visit all was good', 'ROUTINE')).toBe('FOLLOW_UP');
    });

    it('detects FIRST_VISIT', () => {
      expect(classifyRequestType('First time having dental', 'ROUTINE')).toBe('FIRST_VISIT');
      expect(classifyRequestType('I have a new horse', 'ROUTINE')).toBe('FIRST_VISIT');
      expect(classifyRequestType('Horse never had dental work', 'ROUTINE')).toBe('FIRST_VISIT');
      expect(classifyRequestType('Nouveau cheval à la ferme', 'ROUTINE')).toBe('FIRST_VISIT');
    });

    it('detects ADMIN', () => {
      expect(classifyRequestType('Can I get an invoice for last visit', 'ROUTINE')).toBe('ADMIN');
      expect(classifyRequestType('Need a receipt please', 'ROUTINE')).toBe('ADMIN');
      expect(classifyRequestType('Payment query', 'ROUTINE')).toBe('ADMIN');
      expect(classifyRequestType('Envoyez-moi la facture', 'ROUTINE')).toBe('ADMIN');
    });

    it('defaults to ROUTINE_DENTAL', () => {
      expect(classifyRequestType('Book a dental check please', 'ROUTINE')).toBe('ROUTINE_DENTAL');
      expect(classifyRequestType('Some random text', 'SOON')).toBe('ROUTINE_DENTAL');
    });
  });

  // -----------------------------------------------------------------------
  // detectMissingFields
  // -----------------------------------------------------------------------
  describe('detectMissingFields', () => {
    it('detects missing postcode', () => {
      const result = detectMissingFields({
        messageText: 'Need dental check',
        horseCount: 2,
        hasPostcode: false,
        hasYard: false,
      });
      expect(result.some(f => f.field === 'postcode')).toBe(true);
    });

    it('does not flag postcode when hasYard is true', () => {
      const result = detectMissingFields({
        messageText: 'Need dental check',
        horseCount: 2,
        hasPostcode: false,
        hasYard: true,
      });
      expect(result.some(f => f.field === 'postcode')).toBe(false);
    });

    it('detects missing horse count', () => {
      const result = detectMissingFields({
        messageText: 'Need dental check',
        horseCount: null,
        hasPostcode: true,
        hasYard: true,
      });
      expect(result.some(f => f.field === 'horseCount')).toBe(true);
    });

    it('does not flag horse count when provided', () => {
      const result = detectMissingFields({
        messageText: 'Need dental check',
        horseCount: 3,
        hasPostcode: true,
        hasYard: true,
      });
      expect(result.some(f => f.field === 'horseCount')).toBe(false);
    });

    it('detects ambiguous symptoms', () => {
      const result = detectMissingFields({
        messageText: 'My horse is not right lately',
        horseCount: 1,
        hasPostcode: true,
        hasYard: true,
      });
      expect(result.some(f => f.field === 'symptoms')).toBe(true);
    });

    it('returns empty for complete requests', () => {
      const result = detectMissingFields({
        messageText: 'Book a routine dental for 2 horses',
        horseCount: 2,
        hasPostcode: true,
        hasYard: true,
      });
      expect(result).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // estimateDuration
  // -----------------------------------------------------------------------
  describe('estimateDuration', () => {
    it('returns 30 min for 1 horse routine', () => {
      expect(estimateDuration({ horseCount: 1, requestType: 'ROUTINE_DENTAL', urgency: 'ROUTINE' })).toBe(30);
    });

    it('adds 25 min per additional horse', () => {
      expect(estimateDuration({ horseCount: 3, requestType: 'ROUTINE_DENTAL', urgency: 'ROUTINE' })).toBe(80); // 30 + 25 + 25
    });

    it('adds 15 min for first visit', () => {
      expect(estimateDuration({ horseCount: 1, requestType: 'FIRST_VISIT', urgency: 'ROUTINE' })).toBe(45); // 30 + 15
    });

    it('adds 15 min for urgent', () => {
      expect(estimateDuration({ horseCount: 1, requestType: 'URGENT_ISSUE', urgency: 'URGENT' })).toBe(45); // 30 + 15
    });

    it('stacks first visit and urgent bonuses', () => {
      expect(estimateDuration({ horseCount: 1, requestType: 'FIRST_VISIT', urgency: 'URGENT' })).toBe(60); // 30 + 15 + 15
    });

    it('defaults to 1 horse when null', () => {
      expect(estimateDuration({ horseCount: null, requestType: 'ROUTINE_DENTAL', urgency: 'ROUTINE' })).toBe(30);
    });
  });

  // -----------------------------------------------------------------------
  // runTriageRules (integration)
  // -----------------------------------------------------------------------
  describe('runTriageRules', () => {
    it('triages an urgent EN message', () => {
      const result = runTriageRules({
        messageText: 'My horse is in pain and bleeding, please come urgently. 3 horses at BA1 1AA.',
        horseCount: 3,
        hasPostcode: true,
        hasYard: true,
      });
      expect(result.urgency).toBe('URGENT');
      expect(result.requestType).toBe('URGENT_ISSUE');
      expect(result.clinicalFlags).toContain('pain');
      expect(result.clinicalFlags).toContain('bleeding');
      expect(result.needsMoreInfo).toBe(false);
      expect(result.estimatedDuration).toBe(95); // 30 + 25 + 25 + 15(urgent)
    });

    it('triages a routine FR message with missing info', () => {
      const result = runTriageRules({
        messageText: 'Bonjour, je voudrais un contrôle dentaire de routine.',
        horseCount: null,
        hasPostcode: false,
        hasYard: false,
      });
      expect(result.urgency).toBe('ROUTINE');
      expect(result.requestType).toBe('ROUTINE_DENTAL');
      expect(result.needsMoreInfo).toBe(true);
      expect(result.missingFields.length).toBeGreaterThan(0);
    });

    it('triages a FR urgent message', () => {
      const result = runTriageRules({
        messageText: 'Urgence! Mon cheval a une douleur et un abcès',
        horseCount: 1,
        hasPostcode: true,
        hasYard: true,
      });
      expect(result.urgency).toBe('URGENT');
      expect(result.clinicalFlags.length).toBeGreaterThan(0);
    });

    it('triages a follow-up request', () => {
      const result = runTriageRules({
        messageText: 'Need a follow-up after last visit, horse still drooling a bit',
        horseCount: 1,
        hasPostcode: true,
        hasYard: true,
      });
      expect(result.requestType).toBe('FOLLOW_UP');
    });

    it('triages a first visit', () => {
      const result = runTriageRules({
        messageText: 'I have a new horse that has never had dental work done',
        horseCount: 1,
        hasPostcode: true,
        hasYard: true,
        isFirstVisit: true,
      });
      expect(result.requestType).toBe('FIRST_VISIT');
      expect(result.estimatedDuration).toBe(45); // 30 + 15 first visit
    });

    it('sets confidence based on data completeness', () => {
      const complete = runTriageRules({
        messageText: 'Emergency! Horse in pain, 2 horses at yard',
        horseCount: 2,
        hasPostcode: true,
        hasYard: true,
      });
      const incomplete = runTriageRules({
        messageText: 'Hello, dental check please',
        horseCount: null,
        hasPostcode: false,
        hasYard: false,
      });
      expect(complete.confidence).toBeGreaterThan(incomplete.confidence);
    });
  });
});
