import { describe, it, expect } from 'vitest';
import { cn, formatDateGB, truncate } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });
});

describe('formatDateGB', () => {
  it('formats date in dd/MM/yyyy format', () => {
    const date = new Date('2025-03-15T00:00:00Z');
    const result = formatDateGB(date);
    expect(result).toMatch(/15\/03\/2025/);
  });
});

describe('truncate', () => {
  it('returns original string if shorter than max length', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis when exceeding max length', () => {
    const result = truncate('hello world', 8);
    expect(result.length).toBe(8);
    expect(result.endsWith('\u2026')).toBe(true);
  });

  it('returns original string when exactly max length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});
