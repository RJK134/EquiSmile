import { Badge } from './Badge';

type StatusVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
}

export function StatusBadge({ label, variant = 'default' }: StatusBadgeProps) {
  return <Badge variant={variant}>{label}</Badge>;
}
