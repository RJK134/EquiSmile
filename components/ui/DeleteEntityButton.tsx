'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';

import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/**
 * Phase 16, eighth slice — operator-facing soft-delete trigger.
 *
 * Renders nothing for sessions whose role is below `requiredRole`,
 * even before the API call. The DELETE handlers also enforce the
 * role server-side (see `app/api/{customers,yards,horses,enquiries}/[id]/route.ts`)
 * — this is purely UX (don't show a button that will 403).
 *
 * Hard rules:
 *  - The action is destructive. We always show a confirmation modal
 *    naming the entity by its operator-friendly label. There is NO
 *    one-click delete path.
 *  - On 200 we fire a success toast and route the operator back to
 *    the list page (`afterDeletePath`). Detail pages on tombstoned
 *    rows return 404, so leaving the detail page open after delete
 *    would crash the next refresh.
 *  - On non-200 we fire an error toast WITHOUT exposing the response
 *    body to the user — the API may already have logged structured
 *    detail.
 */

export interface DeleteEntityButtonProps {
  /**
   * The DELETE endpoint to call (e.g. `/api/customers/abc-123`).
   */
  endpoint: string;
  /**
   * Operator-friendly entity name shown in the confirmation modal
   * — `"Sarah Jones"`, `"Hill Farm"`, `"Smudge"`, etc.
   */
  entityLabel: string;
  /**
   * The kind of entity being deleted, used to pick translation keys.
   * Maps to `softDelete.<entityKind>.confirm` and similar strings in
   * `messages/{en,fr}.json`.
   */
  entityKind: 'customer' | 'yard' | 'horse' | 'enquiry';
  /**
   * Path to redirect to after successful delete. Pass the
   * locale-agnostic path (e.g. `/customers`) — the locale-aware
   * router from `@/i18n/navigation` adds the active locale prefix
   * automatically.
   */
  afterDeletePath: string;
  /**
   * Lowest role allowed to delete. Defaults to `'admin'` (matches
   * customer / yard / enquiry); `'vet'` for horses (clinical
   * mutation). Anything below renders the component as null.
   */
  requiredRole?: 'admin' | 'vet';
}

const ROLE_RANK: Record<string, number> = { readonly: 1, nurse: 2, vet: 3, admin: 4 };

export function DeleteEntityButton({
  endpoint,
  entityLabel,
  entityKind,
  afterDeletePath,
  requiredRole = 'admin',
}: DeleteEntityButtonProps) {
  const t = useTranslations('softDelete');
  const tc = useTranslations('common');
  const { data: session } = useSession();
  const { addToast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const sessionRole = session?.user?.role ?? 'readonly';
  const allowed = (ROLE_RANK[sessionRole] ?? 0) >= ROLE_RANK[requiredRole];
  // Always render-null below the bar, BEFORE returning any markup,
  // so the button never flashes during hydration for a non-admin
  // operator.
  if (!allowed) return null;

  async function handleConfirm() {
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) {
        addToast(tc('deleteFailed'), 'error');
        setBusy(false);
        return;
      }
      addToast(tc('deleteSuccess'), 'success');
      // Use `replace` so the operator's back-button doesn't bring
      // them back to the now-404 detail page.
      router.replace(afterDeletePath);
    } catch {
      addToast(tc('deleteFailed'), 'error');
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid={`delete-${entityKind}-button`}
      >
        {tc('delete')}
      </Button>

      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title={t(`${entityKind}.confirmTitle`)}
      >
        <p className="text-sm text-foreground">
          {t(`${entityKind}.confirmBody`, { name: entityLabel })}
        </p>
        <p className="mt-3 text-xs text-muted">{t('softDeleteNote')}</p>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
            {tc('cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={busy}
            data-testid={`delete-${entityKind}-confirm`}
          >
            {busy ? tc('loading') : tc('delete')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
