// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { DeleteEntityButton } from '@/components/ui/DeleteEntityButton';

// ---------------------------------------------------------------------------
// Mocks — keep these tight: the component is the unit under test, not next/intl.
// ---------------------------------------------------------------------------

// Stable in-memory translation source. Namespace-aware so the test
// would FAIL if a future regression fetched `deleteSuccess` /
// `deleteFailed` from the wrong namespace (Bugbot #8cb5e879 on PR
// #57): those keys live under `errors.*`, not `common.*`.
const T_TABLE: Record<string, Record<string, string>> = {
  softDelete: {
    'customer.confirmTitle': 'Delete customer',
    'customer.confirmBody': 'Delete {name}?',
    'yard.confirmTitle': 'Delete yard',
    'yard.confirmBody': 'Delete {name}?',
    'horse.confirmTitle': 'Delete horse',
    'horse.confirmBody': 'Delete {name}?',
    'enquiry.confirmTitle': 'Delete enquiry',
    'enquiry.confirmBody': 'Delete this enquiry from {name}?',
    softDeleteNote: 'Hidden but retained.',
  },
  common: {
    delete: 'Delete',
    cancel: 'Cancel',
    loading: 'Loading…',
  },
  errors: {
    deleteSuccess: 'Deleted.',
    deleteFailed: 'Delete failed.',
  },
};

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, vars?: Record<string, string>) => {
    const table = T_TABLE[namespace] ?? {};
    // If the key is missing from the requested namespace, return a
    // distinctive marker so the test fails with a clear message
    // ("MISSING: common.deleteSuccess") rather than rendering the
    // wrong text.
    let value = table[key] ?? `MISSING:${namespace}.${key}`;
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

  // Bugbot #8cb5e879 — namespace regression. The earlier
  // implementation looked up `deleteSuccess`/`deleteFailed` under
  // `common`, but those keys live under `errors.*`. The mock above
  // is namespace-aware and would surface `MISSING:common.…` if the
  // wrong namespace returned. These cases lock that in.
  it('toast on success comes from errors.deleteSuccess (NOT common)', async () => {
    asAdmin();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    render(<DeleteEntityButton {...baseProps} />);

    fireEvent.click(screen.getByTestId('delete-customer-button'));
    fireEvent.click(screen.getByTestId('delete-customer-confirm'));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith('Deleted.', 'success');
    });
    expect(addToastMock).not.toHaveBeenCalledWith(
      expect.stringContaining('MISSING:'),
      expect.anything(),
    );
  });

  it('toast on failure comes from errors.deleteFailed (NOT common)', async () => {
    asAdmin();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    render(<DeleteEntityButton {...baseProps} />);

    fireEvent.click(screen.getByTestId('delete-customer-button'));
    fireEvent.click(screen.getByTestId('delete-customer-confirm'));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith('Delete failed.', 'error');
    });
    expect(addToastMock).not.toHaveBeenCalledWith(
      expect.stringContaining('MISSING:'),
      expect.anything(),
    );
  });
});

describe('DeleteEntityButton — Escape during busy (Bugbot #395dfb62)', () => {
  // Native <dialog> closes itself on Escape BEFORE firing the close
  // event. The earlier `onClose: () => (busy ? undefined : setOpen(false))`
  // skipped the React state update mid-delete, leaving `open=true`
  // while the DOM dialog was visually closed — clicking Delete
  // again was a no-op.
  it('always brings React state in sync with the DOM, even mid-busy', async () => {
    asAdmin();
    // fetch never resolves — keeps the component in `busy=true` while
    // we test the close path.
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => {}));
    render(<DeleteEntityButton {...baseProps} />);

    fireEvent.click(screen.getByTestId('delete-customer-button'));
    fireEvent.click(screen.getByTestId('delete-customer-confirm'));

    // Mid-busy. Simulate Escape → native <dialog> fires its `close`
    // event, which the Modal forwards to `onClose`. The new onClose
    // must always call setOpen(false), even while busy.
    const dialog = document.querySelector('dialog') as HTMLDialogElement | null;
    expect(dialog).toBeTruthy();
    fireEvent(dialog as HTMLDialogElement, new Event('close'));

    // The button must now be re-clickable: clicking it should
    // re-open the dialog (i.e. setOpen(true) succeeds because state
    // returned to false).
    fireEvent.click(screen.getByTestId('delete-customer-button'));

    // The confirm button is still rendered — the modal opened back
    // up cleanly.
    await waitFor(() => {
      expect(screen.getByTestId('delete-customer-confirm')).toBeDefined();
    });
  });
});
