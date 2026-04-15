/**
 * Phase 7 Tests — Structured logger, sensitive data masking, error format.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger, maskPhone, maskEmail, toAppError, createTimer } from '@/lib/utils/logger';

describe('maskPhone', () => {
  it('should mask a UK phone number', () => {
    expect(maskPhone('+447911123456')).toBe('+447******56');
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

  it('should log error messages with error details', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('Something failed', new Error('test error'), { service: 'test' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('Something failed');
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
