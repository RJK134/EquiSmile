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
  },
};

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
