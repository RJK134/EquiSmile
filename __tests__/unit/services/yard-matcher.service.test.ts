import { describe, it, expect } from 'vitest';
import { yardMatcherService } from '@/lib/services/yard-matcher.service';

const stub = (yards: Array<{ id: string; yardName: string; postcode: string; town: string }>) => ({
  yard: {
    findMany: async () => yards,
  },
});

describe('yardMatcherService.matchYard', () => {
  it('returns null when the customer has no yards', async () => {
    const m = await yardMatcherService.matchYard('cust-1', 'anything', stub([]));
    expect(m).toBeNull();
  });

  it('returns sole-yard high-confidence match when only one yard exists', async () => {
    const m = await yardMatcherService.matchYard(
      'cust-1',
      'random text with no yard hints',
      stub([{ id: 'y1', yardName: 'Écurie du Lac', postcode: '1844', town: 'Villeneuve' }]),
    );
    expect(m).toEqual({ yardId: 'y1', confidence: 'high', matchedOn: 'sole-yard' });
  });

  it('matches by Swiss postcode when present', async () => {
    const m = await yardMatcherService.matchYard(
      'cust-1',
      'Need visit at 1820 next week',
      stub([
        { id: 'y1', yardName: 'Écurie du Lac', postcode: '1844', town: 'Villeneuve' },
        { id: 'y2', yardName: 'Centre Équestre Riviera', postcode: '1820', town: 'Montreux' },
      ]),
    );
    expect(m).toEqual({ yardId: 'y2', confidence: 'high', matchedOn: 'postcode' });
  });

  it('matches by yard name (diacritics normalised)', async () => {
    const m = await yardMatcherService.matchYard(
      'cust-1',
      'Please come to ecurie du lac on Tuesday',
      stub([
        { id: 'y1', yardName: 'Écurie du Lac', postcode: '1844', town: 'Villeneuve' },
        { id: 'y2', yardName: 'Centre Équestre Riviera', postcode: '1820', town: 'Montreux' },
      ]),
    );
    expect(m).toEqual({ yardId: 'y1', confidence: 'high', matchedOn: 'name' });
  });

  it('matches by town name as a fallback', async () => {
    const m = await yardMatcherService.matchYard(
      'cust-1',
      'visit at Montreux please',
      stub([
        { id: 'y1', yardName: 'Écurie du Lac', postcode: '1844', town: 'Villeneuve' },
        { id: 'y2', yardName: 'Centre Équestre Riviera', postcode: '1820', town: 'Montreux' },
      ]),
    );
    expect(m).toEqual({ yardId: 'y2', confidence: 'medium', matchedOn: 'town' });
  });

  it('returns null when nothing matches (operator picks)', async () => {
    const m = await yardMatcherService.matchYard(
      'cust-1',
      'unrelated message',
      stub([
        { id: 'y1', yardName: 'Écurie du Lac', postcode: '1844', town: 'Villeneuve' },
        { id: 'y2', yardName: 'Centre Équestre Riviera', postcode: '1820', town: 'Montreux' },
      ]),
    );
    expect(m).toBeNull();
  });

  it('returns null when multiple yard names share matching tokens (ambiguous)', async () => {
    // Both yards contain "ecurie" — matcher cannot auto-assign.
    const m = await yardMatcherService.matchYard(
      'cust-1',
      'visit at the ecurie please',
      stub([
        { id: 'y1', yardName: 'Écurie du Lac', postcode: '1844', town: 'Villeneuve' },
        { id: 'y2', yardName: 'Écurie des Alpes', postcode: '3960', town: 'Sierre' },
      ]),
    );
    expect(m).toBeNull();
  });
});
