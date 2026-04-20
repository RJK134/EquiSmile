/**
 * Minimal RFC 4180-compliant CSV encoder.
 *
 * - Fields containing comma, double-quote, CR, or LF are wrapped in quotes.
 * - Embedded double-quotes are doubled.
 * - Line terminator is CRLF as per the spec.
 * - `null` / `undefined` render as an empty field.
 * - Dates render as ISO-8601 (`toISOString`).
 */

export type CsvCell = string | number | boolean | Date | null | undefined;

export interface CsvColumn<T> {
  key: string;
  label: string;
  value: (row: T) => CsvCell;
}

const RFC4180_SPECIAL = /[",\r\n]/;

export function encodeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else if (typeof value === 'boolean') {
    str = value ? 'true' : 'false';
  } else {
    str = String(value);
  }
  if (RFC4180_SPECIAL.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function encodeCsvRow(cells: CsvCell[]): string {
  return cells.map(encodeCsvCell).join(',');
}

export function encodeCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => encodeCsvCell(c.label)).join(',');
  const body = rows.map((row) => encodeCsvRow(columns.map((c) => c.value(row))));
  return [header, ...body].join('\r\n');
}
