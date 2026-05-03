/**
 * DEMO-03 — Match horse names mentioned in an inbound message
 * against the customer's known horses. Used by the WhatsApp + email
 * webhooks to auto-fill `VisitRequest.specificHorses[]`.
 *
 * Substring match with whole-word boundaries to avoid e.g. "Bell"
 * matching "Bella". Diacritics are normalised so "Éclat" matches
 * "eclat" in casual messages.
 */

import type { PrismaTransactionClient } from '@/lib/prisma';

export interface HorseMatchResult {
  horseNames: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface HorseMatcherClient {
  horse: {
    findMany: (args: {
      where: { customer: { id: string }; deletedAt: null };
      select: { horseName: true };
    }) => Promise<Array<{ horseName: string }>>;
  };
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const horseMatcherService = {
  /**
   * Returns every horse name from the customer's roster that appears
   * in the message text (whole-word match, diacritics ignored).
   *
   *   high     → all customer horses mentioned (rare; usually a
   *              "the whole yard" enquiry).
   *   medium   → at least one horse identified.
   *   low      → no horses identified — caller falls back to count.
   */
  async matchHorses(
    customerId: string,
    messageText: string,
    client: PrismaTransactionClient | HorseMatcherClient,
  ): Promise<HorseMatchResult> {
    const horses = await client.horse.findMany({
      where: { customer: { id: customerId }, deletedAt: null },
      select: { horseName: true },
    });

    if (horses.length === 0) {
      return { horseNames: [], confidence: 'low' };
    }

    const haystack = normalise(messageText);
    const matched: string[] = [];

    for (const horse of horses) {
      const needle = normalise(horse.horseName);
      if (needle.length < 3) continue; // skip ultra-short / accidental matches
      const wordRegex = new RegExp(`\\b${escapeForRegex(needle)}\\b`, 'i');
      if (wordRegex.test(haystack)) {
        matched.push(horse.horseName);
      }
    }

    if (matched.length === 0) return { horseNames: [], confidence: 'low' };
    if (matched.length === horses.length) {
      return { horseNames: matched, confidence: 'high' };
    }
    return { horseNames: matched, confidence: 'medium' };
  },
};
