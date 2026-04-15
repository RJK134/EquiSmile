'use client';

import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="mx-auto max-w-md rounded-lg border border-danger/30 bg-red-50 p-6 text-center"
        >
          <div className="mb-3 text-3xl" aria-hidden="true">!</div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="mb-4 text-sm text-muted">
            An unexpected error occurred. Please try again.
          </p>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre className="mb-4 max-h-32 overflow-auto rounded bg-surface p-2 text-left text-xs text-danger">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
