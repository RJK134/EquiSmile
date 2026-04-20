import { describe, it, expect } from 'vitest';
import { redact, __internals } from '@/lib/utils/log-redact';

describe('redact', () => {
  it('redacts Authorization header values', () => {
    expect(redact({ authorization: 'Bearer sk-abc123' })).toEqual({
      authorization: '[redacted]',
    });
  });

  it('is case-insensitive on keys', () => {
    expect(redact({ Authorization: 'Bearer x', API_KEY: 'abc', 'X-Api-Key': 'y' })).toEqual({
      Authorization: '[redacted]',
      API_KEY: '[redacted]',
      'X-Api-Key': '[redacted]',
    });
  });

  it('redacts OAuth tokens and session keys', () => {
    const input = {
      access_token: 'at',
      refresh_token: 'rt',
      cookie: 'sid=abc',
      password: 'p',
      secret: 's',
      signature: 'sig',
    };
    const out = redact(input) as Record<string, string>;
    for (const v of Object.values(out)) expect(v).toBe('[redacted]');
  });

  it('leaves ordinary values untouched', () => {
    expect(redact({ name: 'Rachel', age: 42, active: true })).toEqual({
      name: 'Rachel',
      age: 42,
      active: true,
    });
  });

  it('redacts Bearer-shaped string values even under innocent keys', () => {
    const out = redact({ greeting: 'Bearer abcdefg' }) as Record<string, string>;
    expect(out.greeting).toBe('[redacted]');
  });

  it('redacts sk- prefixed API keys in value position', () => {
    const out = redact({ message: 'sk-ant-api03-xxxxxxxxxx' }) as Record<string, string>;
    expect(out.message).toBe('[redacted]');
  });

  it('redacts sensitive keys regardless of the value type', () => {
    expect(
      redact({
        password: 12345,
        secret: { data: 'value' },
      })
    ).toEqual({
      password: '[redacted]',
      secret: '[redacted]',
    });
  });

  it('recurses into nested objects and arrays', () => {
    const out = redact({
      config: { auth: { password: 'p' } },
      list: [{ api_key: 'k' }, 'ok'],
    }) as {
      config: { auth: { password: string } };
      list: Array<unknown>;
    };
    expect(out.config.auth.password).toBe('[redacted]');
    expect((out.list[0] as { api_key: string }).api_key).toBe('[redacted]');
    expect(out.list[1]).toBe('ok');
  });

  it('handles circular references without exploding', () => {
    const a: Record<string, unknown> = { name: 'x' };
    a.self = a;
    const out = redact(a) as Record<string, unknown>;
    expect(out.name).toBe('x');
    expect(out.self).toBe('[circular]');
  });

  it('handles circular arrays without exploding', () => {
    const arr: unknown[] = [];
    arr.push(arr);
    expect(redact({ x: arr })).toEqual({
      x: ['[circular]'],
    });
  });

  it('passes through null/undefined', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('internals recognise the expected key list', () => {
    expect(__internals.shouldRedactKey('Authorization')).toBe(true);
    expect(__internals.shouldRedactKey('some_token_here')).toBe(true);
    expect(__internals.shouldRedactKey('normal_field')).toBe(false);
  });
});
