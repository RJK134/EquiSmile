import { describe, it, expect } from 'vitest';
import { getProviderAvailability } from '@/lib/auth/providers';

describe('getProviderAvailability', () => {
  it('returns github=false, email=false for an empty env', () => {
    expect(getProviderAvailability({})).toEqual({
      github: false,
      email: false,
    });
  });

  it('detects github when both AUTH_GITHUB_ID and AUTH_GITHUB_SECRET are set', () => {
    expect(
      getProviderAvailability({
        AUTH_GITHUB_ID: 'id',
        AUTH_GITHUB_SECRET: 'secret',
      }),
    ).toEqual({ github: true, email: false });
  });

  it('does not detect github when only one github var is set', () => {
    expect(
      getProviderAvailability({ AUTH_GITHUB_ID: 'id' }).github,
    ).toBe(false);
  });

  it('detects email only when AUTH_EMAIL_ENABLED=true and all SMTP creds are present', () => {
    expect(
      getProviderAvailability({
        AUTH_EMAIL_ENABLED: 'true',
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'u',
        SMTP_PASSWORD: 'p',
      }),
    ).toEqual({ github: false, email: true });
  });

  it('does not detect email when AUTH_EMAIL_ENABLED is unset even if SMTP is configured', () => {
    expect(
      getProviderAvailability({
        SMTP_HOST: 'smtp.example.com',
        SMTP_USER: 'u',
        SMTP_PASSWORD: 'p',
      }).email,
    ).toBe(false);
  });

  it('does not detect email when AUTH_EMAIL_ENABLED=true but SMTP is incomplete', () => {
    expect(
      getProviderAvailability({
        AUTH_EMAIL_ENABLED: 'true',
        SMTP_HOST: 'smtp.example.com',
      }).email,
    ).toBe(false);
  });
});
