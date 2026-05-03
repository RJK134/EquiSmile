// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StockReplyModal } from '@/components/triage/StockReplyModal';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      'title': 'Reply with a stock template',
      'subtitle': 'Pick a template, preview, confirm.',
      'preview': 'Preview',
      'send': 'Send',
      'sending': 'Sending…',
      'sendError': 'Send failed',
      'templates.faq_acknowledge_v1': 'Acknowledge',
      'templates.faq_request_info_v1': 'Request info',
      'templates.faq_routine_booking_v1': 'Routine booking',
      'templates.faq_emergency_redirect_v1': 'Emergency redirect',
      'cancel': 'Cancel',
    };
    return map[key] ?? key;
  },
}));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('StockReplyModal', () => {
  const baseProps = {
    visitRequestId: 'vr-1',
    customerName: 'Marie Dupont',
    customerLanguage: 'fr',
    onClose: vi.fn(),
    onSent: vi.fn(),
  };

  it('renders the four template options', () => {
    render(<StockReplyModal {...baseProps} />);
    expect(screen.getByText('Acknowledge')).toBeDefined();
    expect(screen.getByText('Request info')).toBeDefined();
    expect(screen.getByText('Routine booking')).toBeDefined();
    expect(screen.getByText('Emergency redirect')).toBeDefined();
  });

  it('disables Send until a template is selected', () => {
    render(<StockReplyModal {...baseProps} />);
    const sendBtn = screen.getByRole('button', { name: 'Send' });
    expect(sendBtn).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByText('Acknowledge'));
    expect(sendBtn).toHaveProperty('disabled', false);
  });

  it('renders a preview body in the customer language after selection', () => {
    render(<StockReplyModal {...baseProps} />);
    fireEvent.click(screen.getByText('Acknowledge'));
    // FR preview: starts with "Bonjour Marie Dupont"
    expect(screen.getByText(/Bonjour Marie Dupont/)).toBeDefined();
  });

  it('calls /api/triage-ops/stock-reply on send and invokes onSent', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sent: true }),
    });

    const onSent = vi.fn();
    render(<StockReplyModal {...baseProps} onSent={onSent} />);
    fireEvent.click(screen.getByText('Acknowledge'));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/triage-ops/stock-reply',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
    });
    await waitFor(() => {
      expect(onSent).toHaveBeenCalledWith('faq_acknowledge_v1');
    });
  });

  it('shows the error banner when the API returns non-ok', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Customer has no contact channels' }),
    });
    render(<StockReplyModal {...baseProps} />);
    fireEvent.click(screen.getByText('Request info'));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Customer has no contact channels');
    });
  });

  it('renders English preview when customer language is en', () => {
    render(<StockReplyModal {...baseProps} customerLanguage="en" />);
    fireEvent.click(screen.getByText('Acknowledge'));
    // EN preview: starts with "Hi Marie Dupont"
    expect(screen.getByText(/Hi Marie Dupont/)).toBeDefined();
  });
});
