/**
 * Phase 7.2 — Structured logging & diagnostics.
 *
 * JSON-formatted log output for production.
 * Log levels: debug, info, warn, error.
 * Sensitive data masking for phone numbers and emails.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  traceId?: string;
  service?: string;
  operation?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    code?: string;
    message: string;
    stack?: string;
  };
}

// ---------------------------------------------------------------------------
// Sensitive data masking
// ---------------------------------------------------------------------------

/**
 * Mask a phone number, keeping first 4 and last 2 digits.
 * E.g., "+447911123456" → "+4479*******56"
 */
export function maskPhone(phone: string): string {
  if (phone.length <= 6) return '***';
  return phone.slice(0, 4) + '*'.repeat(phone.length - 6) + phone.slice(-2);
}

/**
 * Mask an email address, keeping first 2 chars and domain.
 * E.g., "john.doe@example.com" → "jo***@example.com"
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return '***';
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  const visible = Math.min(2, local.length);
  return local.slice(0, visible) + '***' + domain;
}

/**
 * Recursively mask sensitive fields in an object.
 */
function maskSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitive);
  if (typeof obj !== 'object') return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (typeof value === 'string') {
      if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
        result[key] = maskPhone(value);
      } else if (lowerKey.includes('email') || lowerKey === 'to' || lowerKey === 'from') {
        if (value.includes('@')) {
          result[key] = maskEmail(value);
        } else {
          result[key] = value;
        }
      } else if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token')) {
        result[key] = '***';
      } else {
        result[key] = value;
      }
    } else {
      result[key] = maskSensitive(value);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) return envLevel;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[getMinLevel()];
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry);
  }
  // Dev: readable format
  const ctx = entry.context ? ` ${JSON.stringify(maskSensitive(entry.context))}` : '';
  const err = entry.error ? ` | ${entry.error.message}` : '';
  return `[${entry.level.toUpperCase()}] ${entry.message}${ctx}${err}`;
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown,
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context) {
    entry.context = maskSensitive(context) as LogContext;
  }

  if (error) {
    const isError = error instanceof Error;
    entry.error = {
      message: isError ? error.message : String(error),
      stack: process.env.NODE_ENV !== 'production' && isError ? error.stack : undefined,
    };
  }

  return entry;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (!shouldLog('debug')) return;
    const entry = createLogEntry('debug', message, context);
    console.debug(formatEntry(entry));
  },

  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return;
    const entry = createLogEntry('info', message, context);
    console.info(formatEntry(entry));
  },

  warn(message: string, context?: LogContext): void {
    if (!shouldLog('warn')) return;
    const entry = createLogEntry('warn', message, context);
    console.warn(formatEntry(entry));
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    if (!shouldLog('error')) return;
    const entry = createLogEntry('error', message, context, error);
    console.error(formatEntry(entry));
    // Phase 15 — forward to the error-tracking sink (Sentry, Highlight,
    // a log-aggregator webhook — whatever is wired up at boot time).
    // We never throw from the sink; observability must not cascade into
    // a caller-visible failure.
    for (const sink of errorSinks) {
      try {
        sink({ message, error, context: entry.context });
      } catch (sinkError) {
        console.error('[logger] error sink threw', sinkError);
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Pluggable error-tracking sink (Sentry / log-aggregator webhook / ...)
// ---------------------------------------------------------------------------
//
// Why not a hard Sentry dependency:
//   - Deployment shape is still single-VPS; pulling in @sentry/node +
//     its transport forces a binary dependency + DSN before the operator
//     has chosen a vendor.
//   - A sink interface lets us wire up an HTTP post, a Sentry adapter,
//     or an in-process ring buffer (for tests) without touching callers.
//
// Register a sink at app boot — typically in a top-level server file:
//
//     import { registerErrorSink } from '@/lib/utils/logger';
//     registerErrorSink((event) => sentry.captureException(event.error ?? event.message));
//
// If no sink is registered, `logger.error()` still prints to stderr as
// before — zero behavioural change for existing code.

export interface ErrorSinkEvent {
  message: string;
  error?: unknown;
  context?: LogContext;
}

export type ErrorSink = (event: ErrorSinkEvent) => void;

const errorSinks: ErrorSink[] = [];

export function registerErrorSink(sink: ErrorSink): () => void {
  errorSinks.push(sink);
  return () => {
    const i = errorSinks.indexOf(sink);
    if (i >= 0) errorSinks.splice(i, 1);
  };
}

/** Test helper: drop all registered sinks. */
export function __resetErrorSinks(): void {
  errorSinks.length = 0;
}

// ---------------------------------------------------------------------------
// Consistent error format
// ---------------------------------------------------------------------------

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

export function toAppError(error: unknown, code = 'INTERNAL_ERROR'): AppError {
  if (error instanceof Error) {
    return {
      code,
      message: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    };
  }
  return { code, message: String(error) };
}

// ---------------------------------------------------------------------------
// Request timing helper
// ---------------------------------------------------------------------------

export function createTimer(): { elapsed: () => number } {
  const start = Date.now();
  return { elapsed: () => Date.now() - start };
}
