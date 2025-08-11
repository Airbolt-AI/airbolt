import { z } from 'zod';

/**
 * Auth provider configuration schemas
 * Supports discriminated union for type-safe provider-specific configuration
 */
export const AuthProviderConfigSchema = z.discriminatedUnion('provider', [
  // Clerk configuration
  z.object({
    provider: z.literal('clerk'),
    issuer: z.string().url().optional(), // Auto-detected from token
    authorizedParties: z.array(z.string()).optional(),
    publishableKey: z.string().optional(),
    secretKey: z.string().optional(),
  }),

  // Auth0 configuration
  z.object({
    provider: z.literal('auth0'),
    domain: z.string().min(1, 'Auth0 domain is required'),
    audience: z.string().optional(),
    issuer: z.string().url().optional(), // Computed from domain if not provided
  }),

  // Supabase configuration
  z.object({
    provider: z.literal('supabase'),
    url: z.string().url('Supabase URL must be a valid URL'),
    jwtSecret: z
      .string()
      .min(
        32,
        'Supabase JWT secret must be at least 32 characters for security'
      ),
  }),

  // Firebase configuration
  z.object({
    provider: z.literal('firebase'),
    projectId: z.string().min(1, 'Firebase project ID is required'),
  }),

  // Generic OIDC configuration
  z.object({
    provider: z.literal('custom'),
    issuer: z.string().url('Custom OIDC issuer must be a valid URL'),
    jwksUri: z.string().url().optional(), // Default: issuer + /.well-known/jwks.json
    audience: z.string().optional(),
    publicKey: z.string().optional(), // For providers without JWKS
    secret: z.string().optional(), // For HS256 providers
  }),
]);

/**
 * Session token configuration schema
 */
export const SessionTokenConfigSchema = z.object({
  expiresIn: z.string().default('10m'), // 10 minutes
  algorithm: z.enum(['RS256', 'HS256']).default('HS256'),
  secret: z.string().optional(), // Required for HS256
  publicKey: z.string().optional(), // For RS256
});

/**
 * Rate limiting configuration schema
 */
export const RateLimitConfigSchema = z.object({
  exchange: z
    .object({
      max: z.number().int().positive().default(10),
      windowMs: z.number().int().positive().default(900000), // 15 minutes
    })
    .optional(),
});

/**
 * Main auth configuration schema
 */
export const AuthConfigSchema = z.object({
  mode: z.enum(['development', 'managed', 'custom']).default('development'),
  validateJWT: z.boolean().default(true),
  providers: z.array(AuthProviderConfigSchema).default([]),
  sessionToken: SessionTokenConfigSchema.optional(),
  rateLimits: RateLimitConfigSchema.optional(),
});

/**
 * Type exports
 */
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type AuthProviderConfig = z.infer<typeof AuthProviderConfigSchema>;
export type SessionTokenConfig = z.infer<typeof SessionTokenConfigSchema>;
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;
export type AuthMode = AuthConfig['mode'];

/**
 * Helper type for provider names
 */
export type ProviderType = AuthProviderConfig['provider'];

/**
 * Configuration loading function
 * Auto-detects providers from environment variables and creates a complete configuration
 *
 * @param env - Environment variables record
 * @returns Parsed and validated auth configuration
 */
export function loadAuthConfig(
  env: Record<string, string | undefined>
): AuthConfig {
  // Auto-detect providers from environment variables
  const providers: AuthProviderConfig[] = [];

  // Check for Clerk
  if (env['CLERK_PUBLISHABLE_KEY'] || env['CLERK_SECRET_KEY']) {
    const clerkConfig: AuthProviderConfig = {
      provider: 'clerk',
      publishableKey: env['CLERK_PUBLISHABLE_KEY'],
      secretKey: env['CLERK_SECRET_KEY'],
    };

    // Parse authorized parties if provided
    if (env['CLERK_AUTHORIZED_PARTIES']) {
      clerkConfig.authorizedParties = env['CLERK_AUTHORIZED_PARTIES']
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }

    providers.push(clerkConfig);
  }

  // Check for Auth0
  if (env['AUTH0_DOMAIN']) {
    const auth0Config: AuthProviderConfig = {
      provider: 'auth0',
      domain: env['AUTH0_DOMAIN'],
    };

    // Add optional fields if provided
    if (env['AUTH0_AUDIENCE']) {
      auth0Config.audience = env['AUTH0_AUDIENCE'];
    }

    // Compute issuer from domain if not explicitly provided
    if (!env['AUTH0_ISSUER']) {
      auth0Config.issuer = `https://${env['AUTH0_DOMAIN']}/`;
    } else {
      auth0Config.issuer = env['AUTH0_ISSUER'];
    }

    providers.push(auth0Config);
  }

  // Check for Supabase
  if (env['SUPABASE_URL'] && env['SUPABASE_JWT_SECRET']) {
    providers.push({
      provider: 'supabase',
      url: env['SUPABASE_URL'],
      jwtSecret: env['SUPABASE_JWT_SECRET'],
    });
  }

  // Check for Firebase
  if (env['FIREBASE_PROJECT_ID']) {
    providers.push({
      provider: 'firebase',
      projectId: env['FIREBASE_PROJECT_ID'],
    });
  }

  // Check for custom OIDC
  if (env['EXTERNAL_JWT_ISSUER']) {
    const customConfig: AuthProviderConfig = {
      provider: 'custom',
      issuer: env['EXTERNAL_JWT_ISSUER'],
    };

    // Add optional fields if provided
    if (env['EXTERNAL_JWT_JWKS_URI']) {
      customConfig.jwksUri = env['EXTERNAL_JWT_JWKS_URI'];
    }
    if (env['EXTERNAL_JWT_AUDIENCE']) {
      customConfig.audience = env['EXTERNAL_JWT_AUDIENCE'];
    }
    if (env['EXTERNAL_JWT_PUBLIC_KEY']) {
      customConfig.publicKey = env['EXTERNAL_JWT_PUBLIC_KEY'];
    }
    if (env['EXTERNAL_JWT_SECRET']) {
      customConfig.secret = env['EXTERNAL_JWT_SECRET'];
    }

    providers.push(customConfig);
  }

  // Determine auth mode based on providers
  let mode: AuthMode = 'development';
  if (providers.length > 0) {
    // Check if any provider is custom OIDC
    const hasCustomProvider = providers.some(p => p.provider === 'custom');
    mode = hasCustomProvider ? 'custom' : 'managed';
  }

  // Build session token configuration
  const sessionToken: SessionTokenConfig = {
    expiresIn: env['JWT_EXPIRES_IN'] || '10m',
    algorithm: (env['JWT_ALGORITHM'] as 'RS256' | 'HS256') || 'HS256',
    secret: env['JWT_SECRET'],
  };

  // Build rate limit configuration
  const rateLimits: RateLimitConfig = {
    exchange: {
      max: env['AUTH_RATE_LIMIT_MAX']
        ? parseInt(env['AUTH_RATE_LIMIT_MAX'], 10)
        : 10,
      windowMs: env['AUTH_RATE_LIMIT_WINDOW_MS']
        ? parseInt(env['AUTH_RATE_LIMIT_WINDOW_MS'], 10)
        : 900000,
    },
  };

  return AuthConfigSchema.parse({
    mode,
    validateJWT: env['VALIDATE_JWT'] !== 'false',
    providers,
    sessionToken,
    rateLimits,
  });
}

/**
 * Get provider configuration by issuer
 * Searches configured providers to find a match based on issuer patterns
 *
 * @param config - Auth configuration
 * @param issuer - JWT issuer claim
 * @returns Matching provider configuration or undefined
 */
export function getProviderByIssuer(
  config: AuthConfig,
  issuer: string
): AuthProviderConfig | undefined {
  const issuerLower = issuer.toLowerCase();

  return config.providers.find(provider => {
    switch (provider.provider) {
      case 'clerk':
        // Clerk issuers typically contain 'clerk.accounts.dev' or similar patterns
        return (
          issuerLower.includes('clerk.accounts.dev') ||
          issuerLower.includes('clerk.dev') ||
          issuerLower.includes('clerk-')
        );

      case 'auth0':
        // Auth0 issuers match the configured issuer exactly
        return provider.issuer
          ? provider.issuer.toLowerCase() === issuerLower
          : issuerLower.includes(provider.domain.toLowerCase());

      case 'supabase':
        // Supabase issuers typically contain '.supabase.co'
        return (
          issuerLower.includes('.supabase.co') ||
          issuerLower.includes('supabase.')
        );

      case 'firebase':
        // Firebase issuers contain 'securetoken.google.com' or 'firebase'
        return (
          issuerLower.includes('securetoken.google.com') ||
          issuerLower.includes('firebaseapp.com') ||
          issuerLower.includes('firebase.com')
        );

      case 'custom':
        // Custom OIDC providers match the configured issuer exactly
        return provider.issuer.toLowerCase() === issuerLower;

      default:
        return false;
    }
  });
}

/**
 * Check if a specific provider type is configured
 *
 * @param config - Auth configuration
 * @param providerType - Provider type to check
 * @returns True if provider is configured
 */
export function isProviderConfigured(
  config: AuthConfig,
  providerType: ProviderType
): boolean {
  return config.providers.some(provider => provider.provider === providerType);
}

/**
 * Get JWKS URI for a provider
 * Returns the JWKS endpoint URL based on provider configuration
 *
 * @param provider - Provider configuration
 * @returns JWKS URI or undefined if not applicable
 */
export function getJWKSUri(provider: AuthProviderConfig): string | undefined {
  switch (provider.provider) {
    case 'clerk':
      // Clerk JWKS URI is dynamically determined from the token issuer
      // We can't construct it without the issuer from the token
      return undefined;

    case 'auth0':
      // Auth0 JWKS URI follows standard pattern
      return `https://${provider.domain}/.well-known/jwks.json`;

    case 'supabase':
      // Supabase uses HS256 with shared secret, no JWKS
      return undefined;

    case 'firebase':
      // Firebase uses Google's public key endpoint
      return 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

    case 'custom':
      // Custom providers can specify JWKS URI or use well-known endpoint
      return provider.jwksUri || `${provider.issuer}/.well-known/jwks.json`;

    default:
      return undefined;
  }
}

/**
 * Check if a provider uses JWKS for key management
 *
 * @param provider - Provider configuration
 * @returns True if provider uses JWKS
 */
export function usesJWKS(provider: AuthProviderConfig): boolean {
  switch (provider.provider) {
    case 'clerk':
    case 'auth0':
    case 'firebase':
      return true;

    case 'supabase':
      return false; // Uses HS256 with shared secret

    case 'custom':
      return !provider.secret && !provider.publicKey; // Uses JWKS if no direct keys

    default:
      return false;
  }
}

/**
 * Get the expected signing algorithm for a provider
 *
 * @param provider - Provider configuration
 * @returns Expected JWT signing algorithm
 */
export function getExpectedAlgorithm(provider: AuthProviderConfig): string[] {
  switch (provider.provider) {
    case 'clerk':
    case 'auth0':
    case 'firebase':
      return ['RS256']; // RSA signature with SHA-256

    case 'supabase':
      return ['HS256']; // HMAC with SHA-256

    case 'custom':
      if (provider.secret) {
        return ['HS256']; // HMAC if secret provided
      } else {
        return ['RS256', 'ES256']; // Allow both RSA and ECDSA for custom providers
      }

    default:
      return ['RS256', 'HS256']; // Default to common algorithms
  }
}

/**
 * Validate auth configuration
 * Performs additional validation beyond Zod schema
 *
 * @param config - Auth configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateAuthConfig(config: AuthConfig): void {
  // Validate session token configuration
  if (config.sessionToken) {
    if (
      config.sessionToken.algorithm === 'HS256' &&
      !config.sessionToken.secret
    ) {
      throw new Error(
        'JWT secret is required when using HS256 algorithm for session tokens'
      );
    }
  }

  // Validate provider-specific requirements
  for (const provider of config.providers) {
    switch (provider.provider) {
      case 'supabase':
        if (!provider.jwtSecret) {
          throw new Error('Supabase JWT secret is required');
        }
        break;

      case 'auth0':
        if (!provider.domain) {
          throw new Error('Auth0 domain is required');
        }
        break;

      case 'firebase':
        if (!provider.projectId) {
          throw new Error('Firebase project ID is required');
        }
        break;

      case 'custom':
        if (!provider.issuer) {
          throw new Error('Custom OIDC issuer is required');
        }
        // Custom providers must have either JWKS URI, public key, or secret
        if (!provider.jwksUri && !provider.publicKey && !provider.secret) {
          throw new Error(
            'Custom OIDC provider must specify jwksUri, publicKey, or secret'
          );
        }
        break;
    }
  }

  // Validate that at least one provider is configured in non-development mode
  if (config.mode !== 'development' && config.providers.length === 0) {
    throw new Error(
      'At least one auth provider must be configured in managed or custom mode'
    );
  }
}

/**
 * Create authentication providers from configuration
 * Uses the provider factory system to create provider instances
 *
 * @param config - Auth configuration
 * @returns Array of configured authentication provider instances
 * @throws Error if any provider configuration is invalid
 */
export async function createAuthProviders(
  config: AuthConfig
): Promise<import('./types/provider.js').AuthProvider[]> {
  // Import here to avoid circular dependencies
  const { createProviders } = await import('./providers/provider-factory.js');
  return createProviders(config.providers);
}

/**
 * Validate all provider configurations using the factory system
 * Validates configurations without creating actual provider instances
 *
 * @param config - Auth configuration
 * @returns True if all configurations are valid
 * @throws Error if any configuration is invalid
 */
export async function validateAllProviderConfigs(
  config: AuthConfig
): Promise<boolean> {
  // Import here to avoid circular dependencies
  const { validateProviderConfig } = await import(
    './providers/provider-factory.js'
  );

  for (const providerConfig of config.providers) {
    validateProviderConfig(providerConfig);
  }

  return true;
}

/**
 * Create a summary of the auth configuration for logging
 * Excludes sensitive information like secrets and keys
 *
 * @param config - Auth configuration
 * @returns Safe configuration summary
 */
export function createConfigSummary(
  config: AuthConfig
): Record<string, unknown> {
  return {
    mode: config.mode,
    validateJWT: config.validateJWT,
    providerCount: config.providers.length,
    providers: config.providers.map(provider => ({
      type: provider.provider,
      hasSecret:
        provider.provider === 'supabase'
          ? !!provider.jwtSecret
          : provider.provider === 'custom'
            ? !!(provider.secret || provider.publicKey)
            : provider.provider === 'clerk'
              ? !!(provider.secretKey || provider.publishableKey)
              : true,
    })),
    sessionToken: config.sessionToken
      ? {
          algorithm: config.sessionToken.algorithm,
          expiresIn: config.sessionToken.expiresIn,
          hasSecret: !!config.sessionToken.secret,
        }
      : undefined,
    rateLimits: config.rateLimits,
  };
}
