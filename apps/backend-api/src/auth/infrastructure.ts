import type { FastifyRequest, FastifyLoggerInstance } from 'fastify';
import type { JWTVerifyGetKey } from 'jose';
import type { JWTClaims } from '../types/auth.js';
import type { AuthConfig } from './auth-config.js';
import { jwksCache } from './jwks-cache.js';
import { SingleFlight } from './single-flight.js';
import {
  ExchangeRateLimiter,
  createExchangeRateLimiter,
} from './exchange-rate-limiter.js';
import { AuthAuditLogger, createAuthAuditLogger } from './audit-logger.js';

/**
 * Comprehensive infrastructure context interface
 * Includes all shared infrastructure components needed for auth operations
 */
export interface AuthInfrastructureContext {
  /** JWKS cache for JWT key retrieval and caching */
  jwksCache: {
    getOrCreate(issuer: string): JWTVerifyGetKey;
    clear(): void;
    size(): number;
    has(issuer: string): boolean;
  };

  /** Single-flight mechanism for coalescing duplicate operations */
  singleFlight: SingleFlight<JWTClaims>;

  /** Rate limiter for token exchange operations */
  rateLimiter: ExchangeRateLimiter;

  /** Audit logger for security and compliance events */
  auditLogger: AuthAuditLogger;

  /** Fastify logger instance for debugging and monitoring */
  logger: FastifyLoggerInstance;

  /** Complete auth configuration */
  config: AuthConfig;
}

/**
 * Minimal context interface for providers (backward compatibility)
 * This matches the existing VerifyContext interface to ensure no breaking changes
 */
export interface ProviderVerifyContext {
  /** JWKS cache instance for JWT key retrieval */
  jwksCache: {
    getOrCreate(issuer: string): JWTVerifyGetKey;
    clear(): void;
    size(): number;
    has(issuer: string): boolean;
  };
  /** Fastify logger instance for audit and debugging */
  logger: FastifyLoggerInstance;
  /** Complete auth configuration */
  config: AuthConfig;
}

/**
 * Infrastructure manager coordinates all shared auth components
 * Provides centralized access and lifecycle management
 */
export class AuthInfrastructureManager {
  private readonly jwksCache;
  private readonly singleFlight: SingleFlight<JWTClaims>;
  private readonly generalSingleFlight: SingleFlight<any>;
  private rateLimiter: ExchangeRateLimiter;
  private auditLogger: AuthAuditLogger;

  constructor(
    private readonly config: AuthConfig,
    private readonly logger: FastifyLoggerInstance
  ) {
    // Initialize core components
    this.jwksCache = jwksCache;
    this.singleFlight = new SingleFlight<JWTClaims>();
    this.generalSingleFlight = new SingleFlight<any>();

    // Initialize rate limiter with configuration
    const rateLimitConfig = config.rateLimits?.exchange;
    this.rateLimiter = createExchangeRateLimiter(rateLimitConfig);

    // Initialize audit logger
    this.auditLogger = createAuthAuditLogger(logger);

    this.logger.info(
      {
        components: ['jwksCache', 'singleFlight', 'rateLimiter', 'auditLogger'],
        rateLimitMax: rateLimitConfig?.max || 10,
        rateLimitWindowMs: rateLimitConfig?.windowMs || 900000,
      },
      'Auth infrastructure manager initialized'
    );
  }

  /**
   * Get the complete infrastructure context
   * Provides access to all shared components
   */
  getContext(): AuthInfrastructureContext {
    return {
      jwksCache: this.jwksCache,
      singleFlight: this.singleFlight,
      rateLimiter: this.rateLimiter,
      auditLogger: this.auditLogger,
      logger: this.logger,
      config: this.config,
    };
  }

  /**
   * Get provider-compatible verify context (backward compatibility)
   * Ensures existing providers continue to work without changes
   */
  getProviderContext(): ProviderVerifyContext {
    return {
      jwksCache: this.jwksCache,
      logger: this.logger,
      config: this.config,
    };
  }

  /**
   * Generate rate limit key from request
   * Delegates to the rate limiter's built-in key generation
   */
  generateRateLimitKey(request: FastifyRequest): string {
    return this.rateLimiter.generateKey(request);
  }

  /**
   * Check rate limit for a given key
   * @param key - Rate limit key (usually from generateRateLimitKey)
   * @returns Rate limit result with allowed status and metadata
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types -- Inferred return type from rateLimiter
  checkRateLimit(key: string) {
    return this.rateLimiter.checkLimit(key);
  }

  /**
   * Record a request attempt for rate limiting
   * @param key - Rate limit key
   * @param success - Whether the request was successful
   */
  recordRateLimitRequest(key: string, success: boolean): void {
    this.rateLimiter.recordRequest(key, success);
  }

  /**
   * Execute an operation with single-flight coalescing
   * Uses the same single-flight instance for consistency
   *
   * @param key - Unique identifier for the operation
   * @param operation - Function to execute if no operation is in flight
   * @returns Promise resolving to the operation result
   */
  async withSingleFlight<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Use the shared general single-flight instance for non-JWT operations
    // Cast the operation to match the any-typed SingleFlight signature
    return (await this.generalSingleFlight.do(
      key,
      operation as () => Promise<any>
    )) as T;
  }

  /**
   * Get comprehensive statistics for monitoring
   * Includes stats from all infrastructure components
   */
  getStats(): {
    jwksCache: { size: number };
    singleFlight: { inFlightCount: number; keys: readonly string[] };
    rateLimiter: {
      totalKeys: number;
      totalEntries: number;
      memoryUsage: number;
    };
    components: string[];
  } {
    return {
      jwksCache: {
        size: this.jwksCache.size(),
      },
      singleFlight: this.singleFlight.stats(),
      rateLimiter: this.rateLimiter.getStats(),
      components: ['jwksCache', 'singleFlight', 'rateLimiter', 'auditLogger'],
    };
  }

  /**
   * Clean up resources and stop background processes
   * Should be called when shutting down the application
   */
  destroy(): void {
    this.rateLimiter.destroy();
    this.singleFlight.clear();
    this.generalSingleFlight.clear();
    this.jwksCache.clear();

    this.logger.info('Auth infrastructure manager destroyed');
  }

  /**
   * Reset all caches and state (useful for testing)
   * Does not destroy background processes
   */
  reset(): void {
    this.singleFlight.clear();
    this.generalSingleFlight.clear();
    this.jwksCache.clear();

    // Don't reset rate limiter as it maintains important request history
    // Instead, create a new one if needed during testing

    this.logger.debug('Auth infrastructure caches reset');
  }
}

/**
 * Factory function to create an infrastructure manager
 * @param config - Auth configuration
 * @param logger - Fastify logger instance
 * @returns New infrastructure manager instance
 */
export function createAuthInfrastructureManager(
  config: AuthConfig,
  logger: FastifyLoggerInstance
): AuthInfrastructureManager {
  return new AuthInfrastructureManager(config, logger);
}

/**
 * Global infrastructure manager instance
 * Singleton pattern for application-wide access
 */
let globalInfrastructureManager: AuthInfrastructureManager | undefined;

/**
 * Get the global infrastructure manager instance
 * Creates a new instance if none exists
 *
 * @param config - Auth configuration (required for first access)
 * @param logger - Fastify logger instance (required for first access)
 * @returns Global infrastructure manager instance
 */
export function getInfrastructureManager(
  config?: AuthConfig,
  logger?: FastifyLoggerInstance
): AuthInfrastructureManager {
  if (!globalInfrastructureManager) {
    if (!config || !logger) {
      throw new Error(
        'Config and logger are required to initialize global infrastructure manager'
      );
    }
    globalInfrastructureManager = new AuthInfrastructureManager(config, logger);
  }
  return globalInfrastructureManager;
}

/**
 * Reset the global infrastructure manager instance
 * Useful for testing or dynamic reconfiguration
 */
export function resetInfrastructureManager(): void {
  if (globalInfrastructureManager) {
    globalInfrastructureManager.destroy();
    globalInfrastructureManager = undefined;
  }
}
