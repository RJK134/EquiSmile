import type { FinanceInvoiceStatus } from '@prisma/client';

const STATUS_STYLES: Record<FinanceInvoiceStatus, { label: string; className: string }> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-gray-100 text-gray-700 ring-gray-200',
  },
  OPEN: {
    label: 'Open',
    className: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  PARTIAL: {
    label: 'Partial',
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  PAID: {
    label: 'Paid',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  OVERDUE: {
    label: 'Overdue',
    className: 'bg-red-50 text-red-700 ring-red-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-500 ring-gray-200 line-through',
  },
};

export function InvoiceStatusPill({
  status,
  size = 'sm',
}: {
  status: FinanceInvoiceStatus;
  size?: 'sm' | 'md';
}) {
  const config = STATUS_STYLES[status];
  const padding = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset ${padding} ${config.className}`}
      aria-label={`Invoice status: ${config.label}`}
    >
      {config.label}
    </span>
  );
}
