'use client';

import { useEffect, useRef, useCallback, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
      previousFocusRef.current?.focus();
    }
  }, [open]);

  // Focus trap: Tab and Shift+Tab cycle within the modal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Tab') {
        const el = dialogRef.current;
        if (!el) return;

        const focusable = el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [],
  );

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      aria-modal="true"
      aria-labelledby="modal-title"
      className="w-full max-w-lg rounded-lg border border-border bg-background p-0 shadow-lg backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
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
      <div className="p-4">{children}</div>
    </dialog>
  );
}
