import Anthropic from '@anthropic-ai/sdk';

let singleton: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Vision analysis requires a configured Anthropic API key.',
    );
  }
  if (!singleton) {
    singleton = new Anthropic({ apiKey: key });
  }
  return singleton;
}

export const VISION_MODEL = process.env.EQUISMILE_VISION_MODEL || 'claude-opus-4-7';

/**
 * Reset the cached client — used by tests so env-var stubs take effect.
 */
export function __resetAnthropicClientForTests(): void {
  singleton = null;
}
