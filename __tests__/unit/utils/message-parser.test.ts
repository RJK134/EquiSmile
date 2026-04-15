import { describe, it, expect } from 'vitest';
import { parseMessage } from '@/lib/utils/message-parser';

describe('parseMessage', () => {
  it('extracts horse count from text', () => {
    expect(parseMessage('I have 3 horses that need dental work').horseCount).toBe(3);
    expect(parseMessage('horses: 5 at our yard').horseCount).toBe(5);
    expect(parseMessage('J\'ai 2 chevaux').horseCount).toBe(2);
  });

  it('returns null horse count when not mentioned', () => {
    expect(parseMessage('My horse needs a dental check').horseCount).toBeNull();
  });

  it('extracts UK postcodes', () => {
    const result = parseMessage('We are at BA1 1AA near Bath');
    expect(result.postcodes).toContain('BA1 1AA');
  });

  it('extracts French postcodes', () => {
    const result = parseMessage('Notre écurie est à 75001 Paris');
    expect(result.postcodes).toContain('75001');
  });

  it('detects urgency from English keywords', () => {
    expect(parseMessage('My horse is in pain and bleeding').isUrgent).toBe(true);
    expect(parseMessage('Urgent: horse can\'t eat').isUrgent).toBe(true);
    expect(parseMessage('Emergency dental needed asap').isUrgent).toBe(true);
  });

  it('detects urgency from French keywords', () => {
    expect(parseMessage('Mon cheval a une douleur').isUrgent).toBe(true);
    expect(parseMessage('Urgence: saignement').isUrgent).toBe(true);
  });

  it('returns not urgent for routine messages', () => {
    expect(parseMessage('I would like to book a routine dental check').isUrgent).toBe(false);
  });

  it('returns keywords that matched', () => {
    const result = parseMessage('Horse in pain and bleeding');
    expect(result.keywords).toContain('pain');
    expect(result.keywords).toContain('bleeding');
  });

  it('handles empty text', () => {
    const result = parseMessage('');
    expect(result.horseCount).toBeNull();
    expect(result.postcodes).toHaveLength(0);
    expect(result.isUrgent).toBe(false);
    expect(result.keywords).toHaveLength(0);
  });
});
