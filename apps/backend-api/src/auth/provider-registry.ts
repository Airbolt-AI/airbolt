import type { FastifyLoggerInstance } from 'fastify';
import type {
  AuthProvider,
  VerifyContext,
  ProviderRegistry,
  VerificationResult,
  ProviderError,
} from './types/provider.js';
import type { JWTClaims } from '../types/auth.js';
import type { AuthConfig } from './auth-config.js';
import { SingleFlight } from './single-flight.js';
import { jwksCache } from './jwks-cache.js';
import {
  extractIssuer,
  createHashKey,
  sanitizeUserId,
  handleVerificationError,
} from './utils/auth-utils.js';

/**
 * Simplified AuthProviderRegistry manages multiple authentication providers
 * and orchestrates token verification with single-flight coalescing.
 */
export class AuthProviderRegistry implements ProviderRegistry {
  private readonly providers: AuthProvider[] = [];
  private readonly singleFlight = new SingleFlight<VerificationResult>();

  constructor(
    private readonly config: AuthConfig,
    private readonly logger: FastifyLoggerInstance
  ) {
    this.logger.info('AuthProviderRegistry initialized');
  }

  /**
   * Register a new auth provider
   * Providers are automatically sorted by priority (lower number = higher priority)
   *
   * @param provider - Auth provider to register
   */
  register(provider: AuthProvider): void {
    if (!provider) {
      throw new Error('Provider cannot be null or undefined');
    }

    // Basic provider validation
    if (!provider.name || typeof provider.name !== 'string') {
      throw new Error('Provider must have a valid name');
    }

    if (typeof provider.priority !== 'number') {
      throw new Error('Provider must have a valid priority');
    }

    // Add provider and maintain priority order
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);

    this.logger.info(
      {
        provider: provider.name,
        priority: provider.priority,
        totalProviders: this.providers.length,
      },
      'Auth provider registered'
    );
  }

  /**
   * Get all registered providers sorted by priority
   *
   * @returns Array of providers in priority order
   */
  getProviders(): AuthProvider[] {
    return [...this.providers];
  }

  /**
   * Find the first provider that can handle tokens from the given issuer
   * Providers are checked in priority order (lower number = higher priority)
   *
   * @param issuer - JWT issuer claim
   * @returns First matching provider or undefined if none found
   */
  findProvider(issuer: string): AuthProvider | undefined {
    if (!issuer || typeof issuer !== 'string') {
      return undefined;
    }

    for (const provider of this.providers) {
      try {
        if (provider.canHandle(issuer)) {
          this.logger.debug(
            { provider: provider.name, issuer },
            'Provider selected for issuer'
          );
          return provider;
        }
      } catch (error) {
        // Log provider errors but continue searching
        this.logger.warn(
          {
            provider: provider.name,
            issuer,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Provider canHandle check failed'
        );
      }
    }

    this.logger.debug(
      { issuer, checkedProviders: this.providers.length },
      'No provider found for issuer'
    );
    return undefined;
  }

  /**
   * Clear all registered providers
   * Useful for testing or dynamic reconfiguration
   */
  clear(): void {
    const count = this.providers.length;
    this.providers.length = 0;
    this.singleFlight.clear();

    this.logger.info({ clearedProviders: count }, 'All auth providers cleared');
  }

  /**
   * Get the number of registered providers
   *
   * @returns Provider count
   */
  size(): number {
    return this.providers.length;
  }

  /**
   * Main token verification orchestration method
   *
   * Features:
   * - Single-flight coalescing using token hash for deduplication
   * - Automatic provider selection based on token issuer
   * - Shared infrastructure (cache, logger) passed via context
   * - Comprehensive error handling with meaningful messages
   * - Audit logging for security events
   *
   * @param token - JWT token to verify
   * @returns Promise resolving to verification result
   * @throws ProviderError for verification failures
   */
  async verifyToken(token: string): Promise<VerificationResult> {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      const error = new Error(
        'Invalid token: must be a non-empty string'
      ) as ProviderError;
      error.provider = 'registry';
      error.code = 'INVALID_TOKEN_FORMAT';
      throw error;
    }

    // Create hash key for single-flight coalescing
    // Include config hash to handle configuration changes
    const configContext = `providers:${this.providers.length}`;
    const tokenKey = createHashKey(token, configContext);

    return this.singleFlight.do(tokenKey, async () => {
      return this.verifyTokenInternal(token);
    });
  }

  /**
   * Internal token verification implementation without single-flight coalescing
   */
  private async verifyTokenInternal(
    token: string
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      // Extract issuer from token without full verification
      let issuer: string;
      try {
        issuer = extractIssuer(token);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Token parsing failed';
        this.logger.error(
          { error: message },
          'Failed to extract issuer from token'
        );

        const providerError = handleVerificationError(error, 'registry');
        throw providerError;
      }

      // Find appropriate provider for this issuer
      const provider = this.findProvider(issuer);
      if (!provider) {
        this.logger.warn(
          {
            issuer,
            availableProviders: this.providers.map(p => ({
              name: p.name,
              priority: p.priority,
            })),
          },
          'No provider found for token issuer'
        );

        const error = new Error(
          `No authentication provider configured for issuer: ${issuer}`
        ) as ProviderError;
        error.provider = 'registry';
        error.code = 'NO_PROVIDER_FOUND';
        throw error;
      }

      // Create verification context with shared infrastructure
      const context: VerifyContext = {
        jwksCache,
        logger: this.logger,
        config: this.config,
      };

      // Perform token verification with selected provider
      let claims: JWTClaims;
      try {
        claims = await provider.verify(token, context);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown verification error';

        this.logger.error(
          {
            provider: provider.name,
            issuer,
            error: errorMessage,
            duration: Date.now() - startTime,
          },
          'Token verification failed'
        );

        // Enhance error with provider information
        const providerError = handleVerificationError(error, provider.name, {
          issuer,
        });
        throw providerError;
      }

      // Create successful verification result
      const result: VerificationResult = {
        claims,
        provider: provider.name,
        issuer,
        verifiedAt: new Date(),
      };

      const duration = Date.now() - startTime;
      this.logger.info(
        {
          provider: provider.name,
          issuer,
          userId: sanitizeUserId(claims.sub),
          duration,
        },
        'Token verification successful'
      );

      return result;
    } catch (error) {
      // Ensure all errors are properly typed as ProviderError
      if (error && typeof error === 'object' && 'provider' in error) {
        throw error; // Already a ProviderError
      }

      // Convert generic errors to ProviderError
      const providerError = handleVerificationError(error, 'registry');
      throw providerError;
    }
  }
}

/**
 * Singleton registry instance for global use
 * Initialized when first accessed with default configuration
 */
let globalRegistry: AuthProviderRegistry | undefined;

/**
 * Get the global provider registry instance
 * Creates a new instance if none exists
 *
 * @param config - Auth configuration (required for first access)
 * @param logger - Fastify logger instance (required for first access)
 * @returns Global registry instance
 */
export function getProviderRegistry(
  config?: AuthConfig,
  logger?: FastifyLoggerInstance
): AuthProviderRegistry {
  if (!globalRegistry) {
    if (!config || !logger) {
      throw new Error(
        'Config and logger are required to initialize global provider registry'
      );
    }
    globalRegistry = new AuthProviderRegistry(config, logger);
  }
  return globalRegistry;
}

/**
 * Reset the global provider registry instance
 * Useful for testing or dynamic reconfiguration
 */
export function resetProviderRegistry(): void {
  globalRegistry = undefined;
}

/**
 * Create a new provider registry instance
 * Use this when you need a separate registry instance
 *
 * @param config - Auth configuration
 * @param logger - Fastify logger instance
 * @returns New registry instance
 */
export function createProviderRegistry(
  config: AuthConfig,
  logger: FastifyLoggerInstance
): AuthProviderRegistry {
  return new AuthProviderRegistry(config, logger);
}
