export interface ProviderAvailability {
  github: boolean;
  email: boolean;
}

type EnvLike = Record<string, string | undefined>;

export function getProviderAvailability(env: EnvLike = process.env): ProviderAvailability {
  return {
    github: Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET),
    email:
      env.AUTH_EMAIL_ENABLED === 'true' &&
      Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD),
  };
}
