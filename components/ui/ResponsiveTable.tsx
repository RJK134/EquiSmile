'use client';

import { type ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

export function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage,
  onRowClick,
}: ResponsiveTableProps<T>) {
  if (data.length === 0 && emptyMessage) {
    return <p className="py-4 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-2 text-left text-xs font-semibold text-muted">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={`border-b border-border transition-colors hover:bg-surface ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(item)}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onRowClick(item);
                  }
                }}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2">
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 lg:hidden">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className={`rounded-lg border border-border bg-background p-3 ${onRowClick ? 'cursor-pointer active:bg-surface' : ''}`}
            onClick={() => onRowClick?.(item)}
            tabIndex={onRowClick ? 0 : undefined}
            role={onRowClick ? 'button' : undefined}
            onKeyDown={(e) => {
              if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onRowClick(item);
              }
            }}
          >
            {columns
              .filter((col) => !col.hideOnMobile)
              .map((col) => (
                <div key={col.key} className="flex items-center justify-between py-0.5">
                  <span className="text-xs font-medium text-muted">{col.header}</span>
                  <span className="text-sm">{col.render(item)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </>
  );
}
