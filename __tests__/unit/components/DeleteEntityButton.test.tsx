// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { DeleteEntityButton } from '@/components/ui/DeleteEntityButton';

// ---------------------------------------------------------------------------
// Mocks — keep these tight: the component is the unit under test, not next/intl.
// ---------------------------------------------------------------------------

// Stable in-memory translation source so the test asserts the shape the
// component picks (e.g. "softDelete.customer.confirmTitle") rather than
// the wording. Wording is asserted by the i18n parity test.
const T_TABLE: Record<string, string> = {
  // softDelete.*
  'customer.confirmTitle': 'Delete customer',
  'customer.confirmBody': 'Delete {name}?',
  'yard.confirmTitle': 'Delete yard',
  'yard.confirmBody': 'Delete {name}?',
  'horse.confirmTitle': 'Delete horse',
  'horse.confirmBody': 'Delete {name}?',
  'enquiry.confirmTitle': 'Delete enquiry',
  'enquiry.confirmBody': 'Delete this enquiry from {name}?',
  softDeleteNote: 'Hidden but retained.',
  // common.*
  delete: 'Delete',
  cancel: 'Cancel',
  loading: 'Loading…',
  deleteSuccess: 'Deleted.',
  deleteFailed: 'Delete failed.',
};

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, string>) => {
    let value = T_TABLE[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(`{${k}}`, v);
      }
    }
    return value;
  },
}));

const useSessionMock = vi.hoisted(() => vi.fn());
vi.mock('next-auth/react', () => ({
  useSession: useSessionMock,
}));

const routerReplaceMock = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: routerReplaceMock, push: vi.fn() }),
}));

const addToastMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

// HTMLDialogElement.showModal isn't implemented in jsdom; stub it so the
// Modal can mount without throwing.
beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
});

const ORIGINAL_FETCH = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.clearAllMocks();
});

function asAdmin() {
  useSessionMock.mockReturnValue({
    data: { user: { id: 'u1', role: 'admin' } },
    status: 'authenticated',
  });
}
function asReadonly() {
  useSessionMock.mockReturnValue({
    data: { user: { id: 'u1', role: 'readonly' } },
    status: 'authenticated',
  });
}
function asNurse() {
  useSessionMock.mockReturnValue({
    data: { user: { id: 'u1', role: 'nurse' } },
    status: 'authenticated',
  });
}
function asVet() {
  useSessionMock.mockReturnValue({
    data: { user: { id: 'u1', role: 'vet' } },
    status: 'authenticated',
  });
}

const baseProps = {
  endpoint: '/api/customers/cust-1',
  entityLabel: 'Sarah Jones',
  entityKind: 'customer' as const,
  afterDeletePath: '/customers',
};

describe('DeleteEntityButton — role gating', () => {
  it('renders the delete button for admin', () => {
    asAdmin();
    render(<DeleteEntityButton {...baseProps} />);
    expect(screen.getByTestId('delete-customer-button')).toBeDefined();
  });

  it('renders nothing for readonly when admin is required', () => {
    asReadonly();
    const { container } = render(<DeleteEntityButton {...baseProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for nurse when admin is required', () => {
    asNurse();
    const { container } = render(<DeleteEntityButton {...baseProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for vet when admin is required (customer/yard/enquiry)', () => {
    asVet();
    const { container } = render(<DeleteEntityButton {...baseProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders for vet when requiredRole=vet (horse pattern)', () => {
    asVet();
    render(<DeleteEntityButton {...baseProps} entityKind="horse" requiredRole="vet" />);
    expect(screen.getByTestId('delete-horse-button')).toBeDefined();
  });

  it('renders for admin when requiredRole=vet (admin outranks vet)', () => {
    asAdmin();
    render(<DeleteEntityButton {...baseProps} entityKind="horse" requiredRole="vet" />);
    expect(screen.getByTestId('delete-horse-button')).toBeDefined();
  });

  it('renders nothing when there is no session (e.g. mid-load)', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading' });
    const { container } = render(<DeleteEntityButton {...baseProps} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('DeleteEntityButton — confirmation flow', () => {
  it('does NOT call fetch on first click — opens the modal first (no one-click delete)', () => {
    asAdmin();
    globalThis.fetch = vi.fn();
    render(<DeleteEntityButton {...baseProps} />);

    fireEvent.click(screen.getByTestId('delete-customer-button'));

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Delete customer')).toBeDefined();
    expect(screen.getByText('Delete Sarah Jones?')).toBeDefined();
  });

  it('calls DELETE on the configured endpoint after confirmation', async () => {
    asAdmin();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    render(<DeleteEntityButton {...baseProps} />);

    fireEvent.click(screen.getByTestId('delete-customer-button'));
    fireEvent.click(screen.getByTestId('delete-customer-confirm'));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/customers/cust-1', { method: 'DELETE' });
    });
  });

  it('on success: toasts + replaces the route to afterDeletePath', async () => {
    asAdmin();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    render(<DeleteEntityButton {...baseProps} />);

    fireEvent.click(screen.getByTestId('delete-customer-button'));
    fireEvent.click(screen.getByTestId('delete-customer-confirm'));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith('Deleted.', 'success');
    });
    expect(routerReplaceMock).toHaveBeenCalledWith('/customers');
  });

  it('on non-200: toasts the error and stays on the page (no redirect)', async () => {
    asAdmin();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    render(<DeleteEntityButton {...baseProps} />);

    fireEvent.click(screen.getByTestId('delete-customer-button'));
    fireEvent.click(screen.getByTestId('delete-customer-confirm'));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith('Delete failed.', 'error');
    });
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it('on network throw: toasts the error and stays on the page', async () => {
    asAdmin();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('boom'));
    render(<DeleteEntityButton {...baseProps} />);

    fireEvent.click(screen.getByTestId('delete-customer-button'));
    fireEvent.click(screen.getByTestId('delete-customer-confirm'));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith('Delete failed.', 'error');
    });
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });
});
