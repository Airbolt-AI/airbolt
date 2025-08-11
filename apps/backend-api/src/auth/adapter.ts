import type { FastifyRequest } from 'fastify';
import type { JWTClaims } from '../types/auth.js';
import { AuthProvider } from '../plugins/auth-gateway.js';
import {
  AuthInfrastructureManager,
  createAuthInfrastructureManager,
} from './infrastructure.js';
import {
  AuthProviderRegistry,
  createProviderRegistry,
} from './provider-registry.js';
import { loadAuthConfig } from './auth-config.js';
import type { FastifyLoggerInstance } from 'fastify';

/**
 * Adapter layer for smooth interoperability between new provider registry system
 * and existing JWT verification code. Provides migration path and backward compatibility.
 */

/**
 * Legacy JWT verifier interface for compatibility
 * Matches the signature of existing verifyTokenUnified function
 */
export interface LegacyJWTVerifier {
  (token: string): Promise<JWTClaims>;
}

/**
 * Unified authentication adapter that bridges legacy code with new provider system
 * Provides seamless migration path while maintaining existing API contracts
 */
export class AuthAdapter {
  private readonly infrastructure: AuthInfrastructureManager;
  private readonly providerRegistry: AuthProviderRegistry;

  constructor(infrastructure: AuthInfrastructureManager) {
    this.infrastructure = infrastructure;
    const context = infrastructure.getContext();
    this.providerRegistry = createProviderRegistry(
      context.config,
      context.logger
    );
  }

  /**
   * Create a legacy-compatible JWT verifier function
   * This allows existing code to use new provider system with minimal changes
   *
   * @returns Function that matches existing verifyTokenUnified signature
   */
  createLegacyVerifier(): LegacyJWTVerifier {
    return async (token: string): Promise<JWTClaims> => {
      try {
        const result = await this.providerRegistry.verifyToken(token);
        return result.claims;
      } catch (error) {
        // Re-throw errors in the format expected by legacy code
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Token verification failed');
      }
    };
  }

  /**
   * Handle rate limiting with infrastructure manager
   * Provides unified interface for rate limit operations
   */
  handleRateLimit(request: FastifyRequest): {
    allowed: boolean;
    key: string;
    result: {
      allowed: boolean;
      remaining: number;
      resetTime: number;
      totalHits: number;
    };
    record: (success: boolean) => void;
  } {
    const key = this.infrastructure.generateRateLimitKey(request);
    const result = this.infrastructure.checkRateLimit(key);

    return {
      allowed: result.allowed,
      key,
      result,
      record: (success: boolean) => {
        this.infrastructure.recordRateLimitRequest(key, success);
      },
    };
  }

  /**
   * Get audit logger from infrastructure
   * Provides centralized access to audit logging
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types -- Inferred return type is complex nested type
  getAuditLogger() {
    return this.infrastructure.getContext().auditLogger;
  }

  /**
   * Get the provider registry instance
   * Allows direct access to registry for advanced use cases
   */
  getProviderRegistry(): AuthProviderRegistry {
    return this.providerRegistry;
  }

  /**
   * Get the infrastructure manager instance
   * Allows direct access to infrastructure for advanced use cases
   */
  getInfrastructure(): AuthInfrastructureManager {
    return this.infrastructure;
  }

  /**
   * Provider detection utilities for legacy compatibility
   */
  static detectProviderFromClaims(claims: JWTClaims): AuthProvider {
    const issuer = claims.iss?.toLowerCase() || '';

    // Clerk patterns
    if (
      issuer.includes('clerk.accounts.dev') ||
      issuer.includes('clerk.dev') ||
      issuer.includes('clerk-')
    ) {
      return AuthProvider.CLERK;
    }

    // Auth0 patterns
    if (issuer.includes('.auth0.com') || issuer.includes('auth0.')) {
      return AuthProvider.AUTH0;
    }

    // Supabase patterns
    if (issuer.includes('.supabase.co') || issuer.includes('supabase.')) {
      return AuthProvider.SUPABASE;
    }

    // Firebase patterns
    if (
      issuer.includes('securetoken.google.com') ||
      issuer.includes('firebaseapp.com') ||
      issuer.includes('firebase.com')
    ) {
      return AuthProvider.FIREBASE;
    }

    // For custom OIDC or unknown, default to internal since 'custom' isn't in enum
    return AuthProvider.INTERNAL;
  }

  static detectProviderTypeFromToken(token: string): 'clerk' | 'oidc' {
    try {
      // Simple decode to get issuer - don't verify yet
      const parts = token.split('.');
      if (parts.length !== 3) return 'oidc';

      const payloadString = Buffer.from(parts[1]!, 'base64url').toString(
        'utf-8'
      );
      const payload = JSON.parse(payloadString) as { iss?: string };
      const issuer = payload.iss?.toLowerCase() || '';

      if (
        issuer.includes('clerk.accounts.dev') ||
        issuer.includes('clerk.dev') ||
        issuer.includes('clerk-')
      ) {
        return 'clerk';
      }

      return 'oidc';
    } catch {
      return 'oidc'; // Default to OIDC if we can't decode
    }
  }

  /**
   * Get comprehensive statistics from adapter
   * Includes stats from both infrastructure and provider registry
   */
  getStats(): {
    infrastructure: ReturnType<AuthInfrastructureManager['getStats']>;
    providerRegistry: {
      providerCount: number;
      initialized: boolean;
    };
    adapterInfo: {
      legacyCompatibilityMode: boolean;
    };
  } {
    return {
      infrastructure: this.infrastructure.getStats(),
      providerRegistry: {
        providerCount: this.providerRegistry.size(),
        initialized: true,
      },
      adapterInfo: {
        legacyCompatibilityMode: true, // This adapter provides legacy compatibility
      },
    };
  }
}

/**
 * Factory function to create auth adapter with automatic configuration
 * Sets up infrastructure manager and provider registry
 *
 * @param logger - Fastify logger instance
 * @param envOverrides - Optional environment variable overrides for testing
 * @returns Configured auth adapter instance
 */
export function createAuthAdapter(
  logger: FastifyLoggerInstance,
  envOverrides?: Record<string, string>
): AuthAdapter {
  // Load auth configuration
  const env = envOverrides || process.env;
  const config = loadAuthConfig(env);

  // Create infrastructure manager
  const infrastructure = createAuthInfrastructureManager(config, logger);

  // Create adapter
  return new AuthAdapter(infrastructure);
}

/**
 * Global adapter instance for singleton pattern
 */
let globalAdapter: AuthAdapter | undefined;

/**
 * Get global auth adapter instance
 * Creates new instance if none exists
 *
 * @param logger - Fastify logger (required for first access)
 * @param envOverrides - Optional environment overrides for testing
 * @returns Global auth adapter instance
 */
export function getAuthAdapter(
  logger?: FastifyLoggerInstance,
  envOverrides?: Record<string, string>
): AuthAdapter {
  if (!globalAdapter) {
    if (!logger) {
      throw new Error('Logger is required to initialize global auth adapter');
    }
    globalAdapter = createAuthAdapter(logger, envOverrides);
  }
  return globalAdapter;
}

/**
 * Reset global auth adapter instance
 * Useful for testing or dynamic reconfiguration
 */
export function resetAuthAdapter(): void {
  if (globalAdapter) {
    globalAdapter.getInfrastructure().destroy();
    globalAdapter = undefined;
  }
}

/**
 * Migration helper for gradually migrating existing routes
 * Provides side-by-side comparison of old and new verification methods
 */
export class MigrationHelper {
  private readonly adapter: AuthAdapter;
  private readonly legacyVerifier: LegacyJWTVerifier;

  constructor(
    adapter: AuthAdapter,
    legacyVerifier?: (token: string) => Promise<JWTClaims>
  ) {
    this.adapter = adapter;
    this.legacyVerifier = legacyVerifier || adapter.createLegacyVerifier();
  }

  /**
   * Verify token with both old and new methods for comparison
   * Useful during migration to ensure consistency
   *
   * @param token - JWT token to verify
   * @param options - Migration options
   * @returns Verification result with comparison data
   */
  async verifyWithComparison(
    token: string,
    options: {
      preferNew?: boolean;
      logDifferences?: boolean;
    } = {}
  ): Promise<{
    claims: JWTClaims;
    method: 'legacy' | 'new';
    comparisonResult?: {
      bothSucceeded: boolean;
      claimsMatch: boolean;
      differences?: string[];
    };
  }> {
    const { preferNew = true, logDifferences = false } = options;

    let newResult: JWTClaims | Error | undefined;
    let legacyResult: JWTClaims | Error | undefined;

    // Try new method
    try {
      const verificationResult = await this.adapter
        .getProviderRegistry()
        .verifyToken(token);
      newResult = verificationResult.claims;
    } catch (error) {
      newResult =
        error instanceof Error ? error : new Error('New method failed');
    }

    // Try legacy method
    try {
      legacyResult = await this.legacyVerifier(token);
    } catch (error) {
      legacyResult =
        error instanceof Error ? error : new Error('Legacy method failed');
    }

    // Determine which result to use
    const useNew = preferNew && !(newResult instanceof Error);
    const useLegacy = !useNew && !(legacyResult instanceof Error);

    if (!useNew && !useLegacy) {
      // Both failed, throw the preferred method's error
      const errorToThrow =
        preferNew && newResult instanceof Error
          ? newResult
          : legacyResult instanceof Error
            ? legacyResult
            : new Error('Both verification methods failed');
      throw errorToThrow;
    }

    const claims = useNew
      ? (newResult as JWTClaims)
      : (legacyResult as JWTClaims);
    const method = useNew ? 'new' : 'legacy';

    // Create comparison result if both succeeded
    let comparisonResult:
      | {
          bothSucceeded: boolean;
          claimsMatch: boolean;
          differences?: string[];
        }
      | undefined;
    if (!(newResult instanceof Error) && !(legacyResult instanceof Error)) {
      const claimsMatch =
        JSON.stringify(newResult) === JSON.stringify(legacyResult);
      comparisonResult = claimsMatch
        ? {
            bothSucceeded: true,
            claimsMatch,
          }
        : {
            bothSucceeded: true,
            claimsMatch,
            differences: this.findClaimsDifferences(newResult, legacyResult),
          };

      if (logDifferences && !claimsMatch) {
        this.adapter
          .getInfrastructure()
          .getContext()
          .logger.warn(
            {
              token: token.substring(0, 10) + '...',
              differences: comparisonResult?.differences,
            },
            'Claims differences detected between new and legacy verification'
          );
      }
    }

    return comparisonResult
      ? {
          claims,
          method,
          comparisonResult,
        }
      : {
          claims,
          method,
        };
  }

  private findClaimsDifferences(
    claims1: JWTClaims,
    claims2: JWTClaims
  ): string[] {
    const differences: string[] = [];
    const allKeys = new Set([...Object.keys(claims1), ...Object.keys(claims2)]);

    for (const key of allKeys) {
      // eslint-disable-next-line security/detect-object-injection -- Safe: key is from Object.keys() iteration of JWT claims
      const val1 = claims1[key];
      // eslint-disable-next-line security/detect-object-injection -- Safe: key is from Object.keys() iteration of JWT claims
      const val2 = claims2[key];

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        differences.push(
          `${key}: ${JSON.stringify(val1)} vs ${JSON.stringify(val2)}`
        );
      }
    }

    return differences;
  }
}
