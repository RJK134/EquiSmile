// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => {
    const translations: Record<string, string> = {
      new: 'New',
      parsed: 'Parsed',
      needsInfo: 'Needs Info',
      triaged: 'Triaged',
      untriaged: 'Untriaged',
      planningPool: 'Planning Pool',
      booked: 'Booked',
      completed: 'Completed',
      cancelled: 'Cancelled',
      urgent: 'Urgent',
      soon: 'Soon',
      routine: 'Routine',
      whatsapp: 'WhatsApp',
      email: 'Email',
      phone: 'Phone',
      open: 'Open',
      inProgress: 'In Progress',
      done: 'Done',
    };
    return (key: string) => {
      if (translations[key]) return translations[key];
      throw new Error(`Missing translation: ${key}`);
    };
  },
}));

describe('StatusBadge', () => {
  it('renders triage status badge', () => {
    render(<StatusBadge type="triage" value="NEW" />);
    expect(screen.getByText('New')).toBeDefined();
  });

  it('renders planning status badge', () => {
    render(<StatusBadge type="planning" value="PLANNING_POOL" />);
    expect(screen.getByText('Planning Pool')).toBeDefined();
  });

  it('renders urgency badge with correct text', () => {
    render(<StatusBadge type="urgency" value="URGENT" />);
    expect(screen.getByText('Urgent')).toBeDefined();
  });

  it('renders channel badge', () => {
    render(<StatusBadge type="channel" value="WHATSAPP" />);
    expect(screen.getByText('WhatsApp')).toBeDefined();
  });

  it('renders task status badge', () => {
    render(<StatusBadge type="taskStatus" value="OPEN" />);
    expect(screen.getByText('Open')).toBeDefined();
  });

  it('falls back to raw value for unknown status', () => {
    render(<StatusBadge type="triage" value="UNKNOWN_STATUS" />);
    expect(screen.getByText('UNKNOWN_STATUS')).toBeDefined();
  });

  it('renders all triage statuses', () => {
    const statuses = ['NEW', 'PARSED', 'NEEDS_INFO', 'TRIAGED'];
    const expected = ['New', 'Parsed', 'Needs Info', 'Triaged'];

    statuses.forEach((status, i) => {
      const { unmount } = render(<StatusBadge type="triage" value={status} />);
      expect(screen.getByText(expected[i])).toBeDefined();
      unmount();
    });
  });

  it('renders all urgency levels', () => {
    const levels = ['URGENT', 'SOON', 'ROUTINE'];
    const expected = ['Urgent', 'Soon', 'Routine'];

    levels.forEach((level, i) => {
      const { unmount } = render(<StatusBadge type="urgency" value={level} />);
      expect(screen.getByText(expected[i])).toBeDefined();
      unmount();
    });
  });
});
