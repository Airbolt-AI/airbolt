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

export function getProviderConfig(
  provider: string
): (typeof PROVIDER_CONFIG)[ProviderName] | undefined {
  return PROVIDER_CONFIG[provider as ProviderName];
}

export function getDefaultModel(provider: string): string {
  const config = PROVIDER_CONFIG[provider as ProviderName];
  return config?.defaultModel ?? 'gpt-4o-mini';
}

export function getProviderFeatures(
  provider: string
): (typeof PROVIDER_CONFIG)[ProviderName]['features'] | undefined {
  const config = PROVIDER_CONFIG[provider as ProviderName];
  return config?.features;
}

export const PROVIDER_FEATURES = Object.entries(PROVIDER_CONFIG).reduce(
  (acc, [name, config]) => ({
    ...acc,
    [name]: config.features,
  }),
  {} as Record<ProviderName, (typeof PROVIDER_CONFIG)[ProviderName]['features']>
);
