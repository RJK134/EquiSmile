'use client';

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only fixed left-2 top-2 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      Skip to content
    </a>
  );
}
