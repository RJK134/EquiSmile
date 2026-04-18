import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('prisma/seed.ts (production)', () => {
  const seedContent = readFileSync(
    resolve(__dirname, '../../prisma/seed.ts'),
    'utf-8'
  );

  it('imports PrismaClient', () => {
    expect(seedContent).toContain('PrismaClient');
  });

  it('does not contain fake customer data', () => {
    // Production seed should be clean — no sample customers, yards, or horses
    expect(seedContent).not.toContain('seed-customer-sarah');
    expect(seedContent).not.toContain('seed-yard-oakfield');
    expect(seedContent).not.toContain('example.co.uk');
    expect(seedContent).not.toContain('example.fr');
  });

  it('disconnects on success and failure', () => {
    expect(seedContent).toContain('$disconnect');
  });
});

describe('prisma/seed-demo.ts (demo)', () => {
  const demoContent = readFileSync(
    resolve(__dirname, '../../prisma/seed-demo.ts'),
    'utf-8'
  );

  it('uses upsert for idempotency', () => {
    const upsertCount = (demoContent.match(/\.upsert\(/g) || []).length;
    expect(upsertCount).toBeGreaterThanOrEqual(6);
  });

  it('includes both EN and FR customer examples', () => {
    expect(demoContent).toContain('preferredLanguage');
    expect(demoContent).toMatch(/'en'/);
    expect(demoContent).toMatch(/'fr'/);
  });

  it('creates yards with addresses and coordinates', () => {
    expect(demoContent).toContain('latitude');
    expect(demoContent).toContain('longitude');
    expect(demoContent).toContain('postcode');
  });

  it('creates horses linked to customers and yards', () => {
    expect(demoContent).toContain('customerId');
    expect(demoContent).toContain('primaryYardId');
    expect(demoContent).toContain('horseName');
  });

  it('uses Swiss-appropriate content', () => {
    // Demo seed should use Swiss locations
    expect(demoContent).toContain('Switzerland');
  });

  it('disconnects on success and failure', () => {
    expect(demoContent).toContain('$disconnect');
  });
});
