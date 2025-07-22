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
  if (provider === 'openai') return PROVIDER_CONFIG.openai;
  if (provider === 'anthropic') return PROVIDER_CONFIG.anthropic;
  return undefined;
}

export function getDefaultModel(provider: string): string {
  if (provider === 'openai') return PROVIDER_CONFIG.openai.defaultModel;
  if (provider === 'anthropic') return PROVIDER_CONFIG.anthropic.defaultModel;
  return 'gpt-4o-mini';
}

export function getProviderFeatures(
  provider: string
): (typeof PROVIDER_CONFIG)[ProviderName]['features'] | undefined {
  if (provider === 'openai') return PROVIDER_CONFIG.openai.features;
  if (provider === 'anthropic') return PROVIDER_CONFIG.anthropic.features;
  return undefined;
}

export const PROVIDER_FEATURES = Object.entries(PROVIDER_CONFIG).reduce(
  (acc, [name, config]) => ({
    ...acc,
    [name]: config.features,
  }),
  {} as Record<ProviderName, (typeof PROVIDER_CONFIG)[ProviderName]['features']>
);
