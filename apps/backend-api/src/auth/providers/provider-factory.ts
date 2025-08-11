import type {
  AuthProvider,
  ClerkProviderConfig,
  Auth0ProviderConfig,
  ProviderMetadata,
  ProviderFactory,
} from '../types/provider.js';
import type { AuthProviderConfig } from '../auth-config.js';
import { ProviderPriority } from '../types/provider.js';

// Import provider implementations
import { createClerkProvider } from './clerk-provider.js';
import { createAuth0Provider } from './auth0-provider.js';
import { createSupabaseProvider } from './supabase-provider.js';
import { createFirebaseProvider } from './firebase-provider.js';
import { createCustomOIDCProvider } from './custom-oidc-provider.js';

/**
 * Provider factory implementations for each provider type
 */
const providerFactories: Record<string, ProviderFactory> = {
  clerk: (config: AuthProviderConfig) => {
    if (config.provider !== 'clerk') {
      throw new Error('Invalid provider config: expected clerk provider');
    }
    return createClerkProvider(config as ClerkProviderConfig);
  },

  auth0: (config: AuthProviderConfig) => {
    if (config.provider !== 'auth0') {
      throw new Error('Invalid provider config: expected auth0 provider');
    }
    return createAuth0Provider(config as Auth0ProviderConfig);
  },

  supabase: (config: AuthProviderConfig) => {
    if (config.provider !== 'supabase') {
      throw new Error('Invalid provider config: expected supabase provider');
    }
    return createSupabaseProvider();
  },

  firebase: (config: AuthProviderConfig) => {
    if (config.provider !== 'firebase') {
      throw new Error('Invalid provider config: expected firebase provider');
    }
    return createFirebaseProvider();
  },

  custom: (config: AuthProviderConfig) => {
    if (config.provider !== 'custom') {
      throw new Error('Invalid provider config: expected custom provider');
    }
    return createCustomOIDCProvider();
  },
};

/**
 * Provider metadata for registration and discovery
 */
const providerMetadata: Record<string, ProviderMetadata> = {
  clerk: {
    type: 'clerk',
    factory: providerFactories['clerk']!,
    defaultPriority: ProviderPriority.CLERK,
  },

  auth0: {
    type: 'auth0',
    factory: providerFactories['auth0']!,
    defaultPriority: ProviderPriority.AUTH0,
  },

  supabase: {
    type: 'supabase',
    factory: providerFactories['supabase']!,
    defaultPriority: ProviderPriority.SUPABASE,
  },

  firebase: {
    type: 'firebase',
    factory: providerFactories['firebase']!,
    defaultPriority: ProviderPriority.FIREBASE,
  },

  custom: {
    type: 'custom',
    factory: providerFactories['custom']!,
    defaultPriority: ProviderPriority.CUSTOM_OIDC,
  },
};

/**
 * Creates an authentication provider from configuration
 *
 * @param config - Provider configuration object
 * @returns Configured authentication provider instance
 * @throws Error if provider type is not supported or configuration is invalid
 */
/* eslint-disable security/detect-object-injection */
export function createProvider(config: AuthProviderConfig): AuthProvider {
  const providerType = config.provider;

  if (!providerType || typeof providerType !== 'string') {
    throw new Error(
      'Provider configuration must specify a valid provider type'
    );
  }

  const hasFactory = Object.prototype.hasOwnProperty.call(
    providerFactories,
    providerType
  );
  if (!hasFactory) {
    const supportedTypes = Object.keys(providerFactories).join(', ');
    throw new Error(
      `Unsupported provider type: ${providerType}. Supported types: ${supportedTypes}`
    );
  }

  const factory = providerFactories[providerType];
  if (!factory) {
    throw new Error(
      `Factory function not found for provider type: ${providerType}`
    );
  }

  try {
    return factory(config);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to create ${providerType} provider: ${errorMessage}`
    );
  }
}
/* eslint-enable security/detect-object-injection */

/**
 * Creates multiple authentication providers from configurations
 *
 * @param configs - Array of provider configurations
 * @returns Array of configured authentication provider instances
 * @throws Error if any provider configuration is invalid
 */
export function createProviders(configs: AuthProviderConfig[]): AuthProvider[] {
  if (!Array.isArray(configs)) {
    throw new Error('Provider configurations must be an array');
  }

  const providers: AuthProvider[] = [];
  const errors: string[] = [];

  for (let i = 0; i < configs.length; i++) {
    const config = configs.at(i);
    if (!config) {
      errors.push(`Provider ${i}: Configuration is undefined`);
      continue;
    }
    try {
      const provider = createProvider(config);
      providers.push(provider);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      errors.push(
        `Provider ${i} (${config.provider || 'unknown'}): ${errorMessage}`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Failed to create providers:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
  }

  return providers;
}

/**
 * Gets metadata for a specific provider type
 *
 * @param providerType - Provider type identifier
 * @returns Provider metadata or undefined if not found
 */
export function getProviderMetadata(
  providerType: string
): ProviderMetadata | undefined {
  if (Object.prototype.hasOwnProperty.call(providerMetadata, providerType)) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: providerType is validated as string and checked against controlled metadata object
    return providerMetadata[providerType];
  }
  return undefined;
}

/**
 * Gets metadata for all supported provider types
 *
 * @returns Array of all provider metadata
 */
export function getAllProviderMetadata(): ProviderMetadata[] {
  return Object.values(providerMetadata);
}

/**
 * Checks if a provider type is supported
 *
 * @param providerType - Provider type to check
 * @returns True if provider type is supported
 */
export function isProviderTypeSupported(providerType: string): boolean {
  return providerType in providerFactories;
}

/**
 * Gets all supported provider types
 *
 * @returns Array of supported provider type strings
 */
export function getSupportedProviderTypes(): string[] {
  return Object.keys(providerFactories);
}

/**
 * Validates provider configuration without creating the provider
 *
 * @param config - Provider configuration to validate
 * @returns True if configuration is valid
 * @throws Error if configuration is invalid
 */
export function validateProviderConfig(config: AuthProviderConfig): boolean {
  if (!config || typeof config !== 'object') {
    throw new Error('Provider configuration must be an object');
  }

  if (!config.provider || typeof config.provider !== 'string') {
    throw new Error(
      'Provider configuration must specify a valid provider type'
    );
  }

  if (!isProviderTypeSupported(config.provider)) {
    const supportedTypes = getSupportedProviderTypes().join(', ');
    throw new Error(
      `Unsupported provider type: ${config.provider}. Supported types: ${supportedTypes}`
    );
  }

  // Create a temporary provider to validate the configuration
  // This will throw if the configuration is invalid
  try {
    createProvider(config);
    return true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Invalid provider configuration: ${errorMessage}`);
  }
}

/**
 * Registers a custom provider factory
 * Allows extending the factory system with new provider types
 *
 * @param providerType - Unique provider type identifier
 * @param factory - Factory function to create provider instances
 * @param metadata - Provider metadata for registration
 */
export function registerProviderFactory(
  providerType: string,
  factory: ProviderFactory,
  metadata: Omit<ProviderMetadata, 'type'>
): void {
  if (!providerType || typeof providerType !== 'string') {
    throw new Error('Provider type must be a non-empty string');
  }

  if (providerType in providerFactories) {
    throw new Error(`Provider type ${providerType} is already registered`);
  }

  if (typeof factory !== 'function') {
    throw new Error('Provider factory must be a function');
  }

  // Safe dynamic assignment - providerType is validated as string above
  // and we're in control of the provider registration system
  // eslint-disable-next-line security/detect-object-injection -- Safe: providerType is validated as string and we control the registration system
  providerFactories[providerType] = factory;
  // eslint-disable-next-line security/detect-object-injection -- Safe: providerType is validated as string and we control the registration system
  providerMetadata[providerType] = {
    type: providerType,
    ...metadata,
  };
}

/**
 * Unregisters a custom provider factory
 * Removes a provider type from the factory system
 *
 * @param providerType - Provider type to unregister
 * @returns True if provider was unregistered, false if it wasn't registered
 */
export function unregisterProviderFactory(providerType: string): boolean {
  if (!providerType || typeof providerType !== 'string') {
    return false;
  }

  if (!(providerType in providerFactories)) {
    return false;
  }

  // eslint-disable-next-line security/detect-object-injection -- Safe: providerType is validated as string and checked for existence above
  delete providerFactories[providerType];
  // eslint-disable-next-line security/detect-object-injection -- Safe: providerType is validated as string and checked for existence above
  delete providerMetadata[providerType];

  return true;
}

/**
 * Gets the default priority for a provider type
 *
 * @param providerType - Provider type
 * @returns Default priority or undefined if provider type not supported
 */
export function getDefaultPriority(providerType: string): number | undefined {
  if (Object.prototype.hasOwnProperty.call(providerMetadata, providerType)) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: providerType is validated as string and checked against controlled metadata object
    const metadata = providerMetadata[providerType];
    return metadata?.defaultPriority;
  }
  return undefined;
}

/**
 * Sorts provider configurations by priority
 * Uses default priorities from metadata
 *
 * @param configs - Array of provider configurations
 * @returns Sorted array of provider configurations (by priority, lowest first)
 */
export function sortProviderConfigsByPriority(
  configs: AuthProviderConfig[]
): AuthProviderConfig[] {
  return [...configs].sort((a, b) => {
    const aPriority = getDefaultPriority(a.provider) ?? Number.MAX_SAFE_INTEGER;
    const bPriority = getDefaultPriority(b.provider) ?? Number.MAX_SAFE_INTEGER;
    return aPriority - bPriority;
  });
}

/**
 * Creates a provider registry summary for debugging and monitoring
 *
 * @param configs - Array of provider configurations
 * @returns Summary object with provider information
 */
export function createProviderSummary(configs: AuthProviderConfig[]): {
  totalProviders: number;
  providerTypes: string[];
  providersByPriority: Array<{ type: string; priority: number }>;
  supportedTypes: string[];
} {
  const providerTypes = configs.map(config => config.provider);
  const providersByPriority = configs
    .map(config => ({
      type: config.provider,
      priority: getDefaultPriority(config.provider) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.priority - b.priority);

  return {
    totalProviders: configs.length,
    providerTypes,
    providersByPriority,
    supportedTypes: getSupportedProviderTypes(),
  };
}
