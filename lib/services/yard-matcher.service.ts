/**
 * DEMO-03 — Match an inbound message to a yard owned by the
 * customer. Used by the WhatsApp + email webhooks to auto-fill
 * `VisitRequest.yardId` so complete enquiries can flow straight to
 * the planning pool without operator triage.
 *
 * Lightweight substring + postcode matcher — no external fuzzy lib.
 * For Phase 14+ we can swap in a proper similarity algorithm if
 * matching accuracy becomes a complaint, but for the demo the
 * keyword + postcode signals are strong enough.
 */

import type { PrismaTransactionClient } from '@/lib/prisma';

export interface YardMatch {
  yardId: string;
  confidence: 'high' | 'medium' | 'low';
  matchedOn: 'name' | 'postcode' | 'town' | 'sole-yard';
}

export interface YardMatcherClient {
  yard: {
    findMany: (args: {
      where: { customerId: string; deletedAt: null };
      select: { id: true; yardName: true; postcode: true; town: true };
    }) => Promise<
      Array<{ id: string; yardName: string; postcode: string; town: string }>
    >;
  };
}

// Matches a standalone 4-digit Swiss postcode (1000–9999).
// Negative lookbehind/lookahead for date separators (/ . -) prevents
// matching date fragments like "15/03/2024" or "2024-01-15".
const SWISS_POSTCODE = /(?<![/.\-])\b\d{4}\b(?![/.\-])/g;

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsTokens(haystack: string, needle: string): boolean {
  const tokens = normalise(needle)
    .split(' ')
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  return tokens.every((t) => haystack.includes(t));
}

export const yardMatcherService = {
  /**
   * Try to identify which of the customer's yards an inbound message
   * refers to. Returns null if no signal — the operator will pick.
   *
   *   sole-yard  → high confidence (the customer only has one)
   *   postcode   → high confidence (4-digit Swiss postcode hit)
   *   name       → medium-to-high (yard name tokens present)
   *   town       → medium (town name present)
   */
  async matchYard(
    customerId: string,
    messageText: string,
    client: PrismaTransactionClient | YardMatcherClient,
  ): Promise<YardMatch | null> {
    const yards = await client.yard.findMany({
      where: { customerId, deletedAt: null },
      select: { id: true, yardName: true, postcode: true, town: true },
    });

    if (yards.length === 0) return null;
    if (yards.length === 1) {
      return { yardId: yards[0].id, confidence: 'high', matchedOn: 'sole-yard' };
    }

    const lower = normalise(messageText);

    // 1. Postcode wins — Swiss postcodes are 4 digits and unique to a town cluster.
    const postcodes = messageText.match(SWISS_POSTCODE) || [];
    for (const pc of postcodes) {
      const hit = yards.find((y) => y.postcode === pc);
      if (hit) {
        return { yardId: hit.id, confidence: 'high', matchedOn: 'postcode' };
      }
    }

    // 2. Yard-name token match — every significant token must appear.
    const nameHits = yards.filter((y) => containsTokens(lower, y.yardName));
    if (nameHits.length === 1) {
      return { yardId: nameHits[0].id, confidence: 'high', matchedOn: 'name' };
    }
    if (nameHits.length > 1) {
      // Multiple yard names match — too ambiguous to auto-assign.
      return null;
    }

    // 3. Town name match.
    const townHits = yards.filter((y) => lower.includes(normalise(y.town)));
    if (townHits.length === 1) {
      return { yardId: townHits[0].id, confidence: 'medium', matchedOn: 'town' };
    }

    return null;
  },
};
