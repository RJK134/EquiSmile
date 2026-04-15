import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('prisma/seed.ts', () => {
  const seedContent = readFileSync(
    resolve(__dirname, '../../prisma/seed.ts'),
    'utf-8'
  );

  it('uses upsert for idempotency', () => {
    // Every data creation should use upsert, not create
    const upsertCount = (seedContent.match(/\.upsert\(/g) || []).length;
    expect(upsertCount).toBeGreaterThanOrEqual(6); // 2 customers + 2 yards + horses + visits
  });

  it('does not use raw create without upsert', () => {
    // Should not have standalone .create( calls (only inside upsert's create: block)
    const standaloneCreates = seedContent.match(
      /(?<!upsert\(\{[\s\S]*?)prisma\.\w+\.create\(/g
    );
    expect(standaloneCreates).toBeNull();
  });

  it('includes both EN and FR customer examples', () => {
    expect(seedContent).toContain('seed-customer-en');
    expect(seedContent).toContain('seed-customer-fr');
  });

  it('creates yards with addresses and coordinates', () => {
    expect(seedContent).toContain('latitude');
    expect(seedContent).toContain('longitude');
    expect(seedContent).toContain('postcode');
  });

  it('creates horses linked to customers and yards', () => {
    expect(seedContent).toContain('customerId');
    expect(seedContent).toContain('primaryYardId');
    expect(seedContent).toContain('horseName');
  });

  it('creates a routine visit request', () => {
    expect(seedContent).toContain('ROUTINE_DENTAL');
    expect(seedContent).toContain('seed-visit-routine');
  });

  it('creates an urgent visit request', () => {
    expect(seedContent).toContain('URGENT_ISSUE');
    expect(seedContent).toContain('seed-visit-urgent');
  });

  it('uses deterministic IDs for upsert stability', () => {
    expect(seedContent).toContain("id: 'seed-customer-en'");
    expect(seedContent).toContain("id: 'seed-customer-fr'");
    expect(seedContent).toContain("id: 'seed-yard-en'");
    expect(seedContent).toContain("id: 'seed-yard-fr'");
  });
});
