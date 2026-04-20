import { describe, it, expect } from 'vitest';
import { encodeCsv, encodeCsvCell, encodeCsvRow } from '@/lib/services/csv.service';

describe('encodeCsvCell', () => {
  it('renders null and undefined as empty fields', () => {
    expect(encodeCsvCell(null)).toBe('');
    expect(encodeCsvCell(undefined)).toBe('');
  });

  it('passes through simple strings unchanged', () => {
    expect(encodeCsvCell('Rachel')).toBe('Rachel');
  });

  it('quotes and escapes fields containing commas', () => {
    expect(encodeCsvCell('Doe, Jane')).toBe('"Doe, Jane"');
  });

  it('quotes fields containing double quotes and doubles embedded quotes', () => {
    expect(encodeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it('quotes fields containing newlines and carriage returns', () => {
    expect(encodeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(encodeCsvCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('renders booleans as "true"/"false"', () => {
    expect(encodeCsvCell(true)).toBe('true');
    expect(encodeCsvCell(false)).toBe('false');
  });

  it('renders numbers as their string form', () => {
    expect(encodeCsvCell(42)).toBe('42');
    expect(encodeCsvCell(0)).toBe('0');
    expect(encodeCsvCell(-3.14)).toBe('-3.14');
  });

  it('renders Date as ISO-8601', () => {
    const d = new Date('2026-05-01T09:30:00Z');
    expect(encodeCsvCell(d)).toBe('2026-05-01T09:30:00.000Z');
  });
});

describe('encodeCsvRow', () => {
  it('joins cells with a comma', () => {
    expect(encodeCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('handles mixed types and escapes per-cell', () => {
    expect(encodeCsvRow(['Rachel', 'Doe, Jane', 42, null])).toBe('Rachel,"Doe, Jane",42,');
  });
});

describe('encodeCsv', () => {
  type Customer = { id: string; name: string; notes: string | null };

  const rows: Customer[] = [
    { id: '1', name: 'Rachel', notes: null },
    { id: '2', name: 'Doe, Jane', notes: 'Says "hi"' },
  ];

  it('builds a CRLF-terminated CSV with header + data rows', () => {
    const csv = encodeCsv(rows, [
      { key: 'id', label: 'ID', value: (r) => r.id },
      { key: 'name', label: 'Full Name', value: (r) => r.name },
      { key: 'notes', label: 'Notes', value: (r) => r.notes },
    ]);
    expect(csv).toBe(['ID,Full Name,Notes', '1,Rachel,', '2,"Doe, Jane","Says ""hi"""'].join('\r\n'));
  });

  it('produces only a header when the row list is empty', () => {
    expect(
      encodeCsv<Customer>([], [
        { key: 'id', label: 'ID', value: (r) => r.id },
        { key: 'name', label: 'Name', value: (r) => r.name },
      ]),
    ).toBe('ID,Name');
  });
});
