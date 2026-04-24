/**
 * Phase 7 Tests — Structured logger, sensitive data masking, error format.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger, maskPhone, maskEmail, toAppError, createTimer } from '@/lib/utils/logger';

describe('maskPhone', () => {
  it('should mask a UK phone number', () => {
    expect(maskPhone('+447911123456')).toBe('+447*******56');
  });

  it('should mask a short phone number', () => {
    expect(maskPhone('+4412')).toBe('***');
  });

  it('should handle empty string', () => {
    expect(maskPhone('')).toBe('***');
  });
});

describe('maskEmail', () => {
  it('should mask an email address', () => {
    expect(maskEmail('john.doe@example.com')).toBe('jo***@example.com');
  });

  it('should handle single character local part', () => {
    expect(maskEmail('j@example.com')).toBe('j***@example.com');
  });

  it('should handle missing @ sign', () => {
    expect(maskEmail('not-an-email')).toBe('***');
  });
});

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info messages', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('Test message', { service: 'test' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('Test message');
  });

  it('should redact contact fields in log context', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('Outbound message', {
      to: '+447911123456',
      email: 'owner@example.com',
      mobilePhone: '+447700900123',
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0];
    expect(output).toContain('"to":"+447*******56"');
    expect(output).toContain('"email":"ow***@example.com"');
    expect(output).toContain('"mobilePhone":"+447*******23"');
  });

  it('should log error messages with error details', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('Something failed', new Error('test error'), { service: 'test' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('Something failed');
  });

  it('should redact token-like fields in log context', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('Webhook failure', {
      token: 'secret-token',
      authorization: 'Bearer sk-ant-api03-abc123456789',
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0];
    expect(output).toContain('"token":"***"');
    expect(output).toContain('"authorization":"***"');
  });

  it('should mask non-contact identifiers in to/from fields', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('Dispatch queued', {
      to: 'wamid.abc123456789',
      from: 'acct_internal_channel',
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0];
    expect(output).toContain('"to":"wa***89"');
    expect(output).toContain('"from":"ac***el"');
  });

  it('should log warn messages', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('Warning message');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('toAppError', () => {
  it('should convert Error to AppError', () => {
    const error = new Error('Test error');
    const appError = toAppError(error, 'TEST_ERROR');
    expect(appError.code).toBe('TEST_ERROR');
    expect(appError.message).toBe('Test error');
  });

  it('should convert string to AppError', () => {
    const appError = toAppError('string error');
    expect(appError.code).toBe('INTERNAL_ERROR');
    expect(appError.message).toBe('string error');
  });
});

describe('createTimer', () => {
  it('should measure elapsed time', async () => {
    const timer = createTimer();
    await new Promise((r) => setTimeout(r, 50));
    const elapsed = timer.elapsed();
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(elapsed).toBeLessThan(200);
  });
});
