'use client';

import { Badge } from './Badge';
import { useTranslations } from 'next-intl';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

// Triage status badge
const triageStatusMap: Record<string, { variant: BadgeVariant; key: string }> = {
  NEW: { variant: 'info', key: 'new' },
  PARSED: { variant: 'default', key: 'parsed' },
  NEEDS_INFO: { variant: 'warning', key: 'needsInfo' },
  TRIAGED: { variant: 'success', key: 'triaged' },
};

// Planning status badge
const planningStatusMap: Record<string, { variant: BadgeVariant; key: string }> = {
  UNTRIAGED: { variant: 'default', key: 'untriaged' },
  READY_FOR_REVIEW: { variant: 'info', key: 'readyForReview' },
  PLANNING_POOL: { variant: 'info', key: 'planningPool' },
  CLUSTERED: { variant: 'warning', key: 'clustered' },
  DRAFT: { variant: 'default', key: 'draft' },
  PROPOSED: { variant: 'warning', key: 'proposed' },
  APPROVED: { variant: 'success', key: 'approved' },
  BOOKED: { variant: 'success', key: 'booked' },
  COMPLETED: { variant: 'success', key: 'completed' },
  CANCELLED: { variant: 'danger', key: 'cancelled' },
};

// Urgency badge
const urgencyMap: Record<string, { variant: BadgeVariant; key: string }> = {
  URGENT: { variant: 'danger', key: 'urgent' },
  SOON: { variant: 'warning', key: 'soon' },
  ROUTINE: { variant: 'success', key: 'routine' },
};

// Channel badge
const channelMap: Record<string, { variant: BadgeVariant; key: string }> = {
  WHATSAPP: { variant: 'success', key: 'whatsapp' },
  EMAIL: { variant: 'info', key: 'email' },
  PHONE: { variant: 'default', key: 'phone' },
};

// Task status badge
const taskStatusMap: Record<string, { variant: BadgeVariant; key: string }> = {
  OPEN: { variant: 'warning', key: 'open' },
  IN_PROGRESS: { variant: 'info', key: 'inProgress' },
  DONE: { variant: 'success', key: 'done' },
};

// Appointment status badge
const appointmentStatusMap: Record<string, { variant: BadgeVariant; key: string }> = {
  PROPOSED: { variant: 'warning', key: 'proposed' },
  CONFIRMED: { variant: 'info', key: 'confirmed' },
  COMPLETED: { variant: 'success', key: 'completed' },
  CANCELLED: { variant: 'danger', key: 'cancelled' },
  NO_SHOW: { variant: 'danger', key: 'noShow' },
};

interface StatusBadgeProps {
  type: 'triage' | 'planning' | 'urgency' | 'channel' | 'taskStatus' | 'appointment';
  value: string;
}

const maps: Record<StatusBadgeProps['type'], Record<string, { variant: BadgeVariant; key: string }>> = {
  triage: triageStatusMap,
  planning: planningStatusMap,
  urgency: urgencyMap,
  channel: channelMap,
  taskStatus: taskStatusMap,
  appointment: appointmentStatusMap,
};

export function StatusBadge({ type, value }: StatusBadgeProps) {
  const t = useTranslations('status');
  const map = maps[type];
  const config = map[value] ?? { variant: 'default' as const, key: value.toLowerCase() };

  let label: string;
  try {
    label = t(config.key);
  } catch {
    label = value;
  }

  return <Badge variant={config.variant}>{label}</Badge>;
}
