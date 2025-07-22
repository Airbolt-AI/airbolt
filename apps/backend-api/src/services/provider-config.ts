// Provider configuration structure
// Required fields: envKey, defaultModel, keyRegex, keyFormat, features
// Optional fields can be added directly when needed
// Example: headers?: Record<string, string>, baseUrl?: string, etc.

export const PROVIDER_CONFIG = {
  openai: {
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    keyRegex: /^sk-(?:proj-)?[A-Za-z0-9_-]+$/,
    keyFormat: 'sk-... or sk-proj-...',
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
    },
  },
  anthropic: {
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-sonnet-20241022',
    keyRegex: /^sk-ant-[A-Za-z0-9_-]+$/,
    keyFormat: 'sk-ant-...',
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
    },
  },
} as const;

export type ProviderName = keyof typeof PROVIDER_CONFIG;
export type ProviderFeature = keyof typeof PROVIDER_CONFIG.openai.features;

export class UnknownProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly suggestedFallback = 'gpt-4o-mini'
  ) {
    super(
      `Unknown AI provider: "${provider}". Valid providers are: ${Object.keys(
        PROVIDER_CONFIG
      ).join(', ')}`
    );
    this.name = 'UnknownProviderError';
  }
}

/**
 * Type guard to check if a string is a valid provider name
 */
export function isProviderName(provider: string): provider is ProviderName {
  return Object.hasOwn(PROVIDER_CONFIG, provider);
}

export function getProviderConfig<T extends ProviderName>(
  provider: T
): (typeof PROVIDER_CONFIG)[T];
export function getProviderConfig(
  provider: string
): (typeof PROVIDER_CONFIG)[ProviderName] | undefined;
export function getProviderConfig(
  provider: string
): (typeof PROVIDER_CONFIG)[ProviderName] | undefined {
  if (isProviderName(provider)) {
    // Safe: isProviderName type guard ensures provider is a known key
    // eslint-disable-next-line security/detect-object-injection
    return PROVIDER_CONFIG[provider];
  }
  return undefined;
}

export function getDefaultModel<T extends ProviderName>(provider: T): string;
export function getDefaultModel(provider: string): string;
export function getDefaultModel(provider: string): string {
  if (isProviderName(provider)) {
    // Safe: isProviderName type guard ensures provider is a known key
    // eslint-disable-next-line security/detect-object-injection
    return PROVIDER_CONFIG[provider].defaultModel;
  }

  throw new UnknownProviderError(provider);
}

export function getProviderFeatures<T extends ProviderName>(
  provider: T
): (typeof PROVIDER_CONFIG)[T]['features'];
export function getProviderFeatures(
  provider: string
): (typeof PROVIDER_CONFIG)[ProviderName]['features'] | undefined;
export function getProviderFeatures(
  provider: string
): (typeof PROVIDER_CONFIG)[ProviderName]['features'] | undefined {
  if (isProviderName(provider)) {
    // Safe: isProviderName type guard ensures provider is a known key
    // eslint-disable-next-line security/detect-object-injection
    return PROVIDER_CONFIG[provider].features;
  }
  return undefined;
}

export const PROVIDER_FEATURES = Object.entries(PROVIDER_CONFIG).reduce(
  (acc, [name, config]) => ({
    ...acc,
    [name]: config.features,
  }),
  {} as Record<ProviderName, (typeof PROVIDER_CONFIG)[ProviderName]['features']>
);
