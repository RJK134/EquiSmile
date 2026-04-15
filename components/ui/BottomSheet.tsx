'use client';

import { useEffect, useRef, useCallback, type ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      aria-modal="true"
      aria-labelledby="bottom-sheet-title"
      className="fixed inset-x-0 bottom-0 m-0 w-full max-w-full rounded-t-2xl border-t border-border bg-background p-0 shadow-2xl backdrop:bg-black/50 lg:inset-auto lg:m-auto lg:max-w-lg lg:rounded-lg lg:border"
    >
      <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-border lg:hidden" aria-hidden="true" />
      <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-1 lg:pt-3">
        <h2 id="bottom-sheet-title" className="text-base font-semibold">{title}</h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-4 pb-safe">{children}</div>
    </dialog>
  );
}
