import { describe, it, expect } from 'vitest';
import { horseMatcherService } from '@/lib/services/horse-matcher.service';

const stub = (names: string[]) => ({
  horse: {
    findMany: async () => names.map((horseName) => ({ horseName })),
  },
});

describe('horseMatcherService.matchHorses', () => {
  it('returns low confidence + empty list when customer has no horses', async () => {
    const r = await horseMatcherService.matchHorses('c1', 'Bella please', stub([]));
    expect(r).toEqual({ horseNames: [], confidence: 'low' });
  });

  it('matches a single mentioned horse with whole-word boundary', async () => {
    const r = await horseMatcherService.matchHorses(
      'c1',
      'Need visit for Bella at Aigle',
      stub(['Bella', 'Thunder', 'Luna']),
    );
    expect(r.horseNames).toEqual(['Bella']);
    expect(r.confidence).toBe('medium');
  });

  it('does NOT match partial substrings (Bell != Bella)', async () => {
    const r = await horseMatcherService.matchHorses(
      'c1',
      'The doorbell is broken',
      stub(['Bella']),
    );
    expect(r.horseNames).toEqual([]);
    expect(r.confidence).toBe('low');
  });

  it('matches multiple horses', async () => {
    const r = await horseMatcherService.matchHorses(
      'c1',
      'Annual checks for Bella and Max please',
      stub(['Bella', 'Max', 'Luna']),
    );
    expect(r.horseNames.sort()).toEqual(['Bella', 'Max']);
    expect(r.confidence).toBe('medium');
  });

  it('returns high confidence when every horse is mentioned', async () => {
    const r = await horseMatcherService.matchHorses(
      'c1',
      'Bella, Max, Luna — full yard check',
      stub(['Bella', 'Max', 'Luna']),
    );
    expect(r.horseNames.sort()).toEqual(['Bella', 'Luna', 'Max']);
    expect(r.confidence).toBe('high');
  });

  it('normalises diacritics (Éclat matches eclat)', async () => {
    const r = await horseMatcherService.matchHorses(
      'c1',
      'rendez-vous pour eclat svp',
      stub(['Éclat']),
    );
    expect(r.horseNames).toEqual(['Éclat']);
  });
});
