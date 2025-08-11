import type { FastifyPluginAsync } from 'fastify';
import {
  isDevelopmentMode,
  generateDevelopmentToken,
} from '../../../auth/jwt-verifier.js';
import { type JWTClaims } from '../../../types/auth.js';
import { AuthProvider } from '../../../plugins/auth-gateway.js';
import { createExchangeRateLimiter } from '../../../auth/exchange-rate-limiter.js';
import { loadAuthConfig } from '../../../auth/auth-config.js';
import { createAuthAuditLogger } from '../../../auth/audit-logger.js';
import {
  createProviderRegistry,
  type AuthProviderRegistry,
} from '../../../auth/provider-registry.js';
import type {
  ProviderError,
  VerificationResult,
  AuthProvider as AuthProviderType,
} from '../../../auth/types/provider.js';
import { clerkProvider } from '../../../auth/providers/clerk-provider.js';
import { auth0Provider } from '../../../auth/providers/auth0-provider.js';
import { supabaseProvider } from '../../../auth/providers/supabase-provider.js';
import { firebaseProvider } from '../../../auth/providers/firebase-provider.js';
import { customOIDCProvider } from '../../../auth/providers/custom-oidc-provider.js';

/**
 * Detect provider from verified JWT claims
 * Uses issuer patterns to identify the authentication provider
 * Maps provider registry names to AuthProvider enum
 */
function detectProviderFromClaims(claims: JWTClaims): AuthProvider {
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

/**
 * Map provider registry provider names to AuthProvider enum
 * The registry uses different naming conventions than the gateway enum
 */
function mapRegistryProviderToAuthProvider(
  registryProvider: string
): AuthProvider {
  switch (registryProvider.toLowerCase()) {
    case 'clerk':
      return AuthProvider.CLERK;
    case 'auth0':
      return AuthProvider.AUTH0;
    case 'supabase':
      return AuthProvider.SUPABASE;
    case 'firebase':
      return AuthProvider.FIREBASE;
    case 'custom':
    case 'custom-oidc':
      return AuthProvider.INTERNAL; // Map custom OIDC to INTERNAL for gateway compatibility
    default:
      return AuthProvider.INTERNAL;
  }
}

/**
 * Unified token verification using the provider registry
 * Falls back to basic decoding in development mode if proper verification fails
 */
async function verifyTokenWithRegistry(
  token: string,
  registry: AuthProviderRegistry
): Promise<{ claims: JWTClaims; provider: string }> {
  try {
    // Use provider registry for token verification
    const result: VerificationResult = await registry.verifyToken(token);
    return {
      claims: result.claims,
      provider: result.provider,
    };
  } catch (error) {
    // In development mode, fall back to basic token decoding for backwards compatibility
    if (isDevelopmentMode()) {
      const claims = fallbackTokenDecoding(token);
      return {
        claims,
        provider: 'development',
      };
    }
    throw error;
  }
}

/**
 * Fallback token decoding for development mode
 * Provides backwards compatibility with mock tokens
 */
function fallbackTokenDecoding(token: string): JWTClaims {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payloadString = Buffer.from(parts[1]!, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadString) as Record<string, unknown>;

    // Convert to JWTClaims format with type safety
    const claims: JWTClaims = {
      sub: typeof payload['sub'] === 'string' ? payload['sub'] : 'unknown',
      iss: typeof payload['iss'] === 'string' ? payload['iss'] : 'development',
      exp:
        typeof payload['exp'] === 'number'
          ? payload['exp']
          : Math.floor(Date.now() / 1000) + 600,
      iat:
        typeof payload['iat'] === 'number'
          ? payload['iat']
          : Math.floor(Date.now() / 1000),
    };

    // Add optional fields if present
    if (payload['aud']) {
      claims.aud = payload['aud'] as string | string[];
    }
    if (payload['email'] && typeof payload['email'] === 'string') {
      claims.email = payload['email'];
    }

    // Add any additional claims with type safety
    const standardClaims = new Set([
      'sub',
      'iss',
      'exp',
      'iat',
      'aud',
      'email',
    ]);
    Object.keys(payload).forEach(key => {
      if (!standardClaims.has(key) && typeof key === 'string') {
        // eslint-disable-next-line security/detect-object-injection -- Controlled key from JWT payload
        claims[key] = payload[key];
      }
    });

    return claims;
  } catch (error) {
    throw new Error('Failed to decode token even in development mode');
  }
}

const exchange: FastifyPluginAsync = async (fastify): Promise<void> => {
  // Load auth configuration from environment
  const authConfig = loadAuthConfig(process.env);

  // Initialize provider registry with simplified providers
  let providerRegistry: AuthProviderRegistry | null = null;
  try {
    fastify.log.debug(
      {
        configuredProviders: authConfig.providers.length,
        providers: authConfig.providers.map(p => p.provider),
      },
      'Attempting to create provider registry from config'
    );

    providerRegistry = createProviderRegistry(authConfig, fastify.log);

    // Register simplified providers directly based on configuration
    const registeredProviders: AuthProviderType[] = [];

    // Check each configured provider and register the corresponding object
    for (const providerConfig of authConfig.providers) {
      switch (providerConfig.provider) {
        case 'clerk':
          providerRegistry.register(clerkProvider);
          registeredProviders.push(clerkProvider);
          break;
        case 'auth0':
          providerRegistry.register(auth0Provider);
          registeredProviders.push(auth0Provider);
          break;
        case 'supabase':
          providerRegistry.register(supabaseProvider);
          registeredProviders.push(supabaseProvider);
          break;
        case 'firebase':
          providerRegistry.register(firebaseProvider);
          registeredProviders.push(firebaseProvider);
          break;
        case 'custom':
          providerRegistry.register(customOIDCProvider);
          registeredProviders.push(customOIDCProvider);
          break;
        default:
          fastify.log.warn(
            { provider: providerConfig.provider },
            'Provider not yet imported in exchange endpoint, skipping registration'
          );
      }
    }

    fastify.log.info(
      {
        registeredProviders: registeredProviders.length,
        supportedProviders: registeredProviders.map(p => p.name),
      },
      'Provider registry initialized with simplified providers'
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : '';
    fastify.log.warn(
      {
        error: errorMessage,
        stack,
        authConfigProviders: authConfig.providers.length,
      },
      'Failed to initialize provider registry, falling back to legacy verification'
    );
  }

  // Initialize rate limiter with configuration
  const rateLimitConfig = authConfig.rateLimits?.exchange;
  const rateLimiter = createExchangeRateLimiter(rateLimitConfig);

  // Initialize audit logger
  const auditLogger = createAuthAuditLogger(fastify.log);
  fastify.post(
    '/exchange',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Exchange provider token for session token',
        description:
          'Exchange a valid provider token for an internal session token',
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            description: 'Token exchange successful',
            type: 'object',
            required: ['sessionToken', 'expiresAt', 'provider'],
            properties: {
              sessionToken: {
                type: 'string',
                description: 'Internal session JWT token',
              },
              expiresAt: {
                type: 'string',
                format: 'date-time',
                description: 'Token expiration timestamp (ISO format)',
              },
              provider: {
                type: 'string',
                description: 'Authentication provider used',
              },
            },
          },
          401: {
            description: 'Unauthorized - Invalid or missing provider token',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          400: {
            description: 'Bad Request - Invalid input or malformed token',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          429: {
            description: 'Too Many Requests - Rate limit exceeded',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
              retryAfter: { type: 'number' },
            },
            headers: {
              'X-RateLimit-Limit': { type: 'string' },
              'X-RateLimit-Remaining': { type: 'string' },
              'X-RateLimit-Reset': { type: 'string' },
              'Retry-After': { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Generate rate limit key and check limit
      const rateLimitKey = rateLimiter.generateKey(request);
      const rateLimitResult = rateLimiter.checkLimit(rateLimitKey);

      // Set rate limit headers
      const rateLimitMax = rateLimitConfig?.max || 10;
      reply.header('X-RateLimit-Limit', rateLimitMax.toString());
      reply.header(
        'X-RateLimit-Remaining',
        rateLimitResult.remaining.toString()
      );
      reply.header(
        'X-RateLimit-Reset',
        new Date(rateLimitResult.resetTime).toISOString()
      );

      // Check if rate limit exceeded
      if (!rateLimitResult.allowed) {
        const retryAfterSeconds = Math.ceil(
          (rateLimitResult.resetTime - Date.now()) / 1000
        );
        reply.header('Retry-After', retryAfterSeconds.toString());

        // Log rate limit violation with audit logger
        auditLogger.logRateLimitExceeded(
          request,
          rateLimitResult.totalHits,
          retryAfterSeconds,
          rateLimitConfig?.windowMs || 900000,
          rateLimitMax
        );

        return reply.code(429).send({
          error: 'TooManyRequests',
          message: 'Rate limit exceeded for token exchange',
          statusCode: 429,
          retryAfter: retryAfterSeconds,
        });
      }

      try {
        // Extract Bearer token from Authorization header
        const authHeader = request.headers.authorization;

        // Development mode: Generate tokens for users without auth headers
        if (!authHeader && isDevelopmentMode()) {
          const identifier = request.ip || 'unknown';
          const devToken = generateDevelopmentToken(identifier);

          // Record successful request
          rateLimiter.recordRequest(rateLimitKey, true);

          // Log development token generation with audit logger
          auditLogger.logDevelopmentTokenGenerated(
            request,
            identifier,
            rateLimitResult.remaining - 1
          );

          return reply.code(200).send({
            sessionToken: devToken,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
            provider: 'development',
          });
        }

        if (!authHeader) {
          auditLogger.logTokenExchangeFailure(
            request,
            'Authorization header is required',
            'MISSING_AUTH_HEADER'
          );
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Authorization header is required',
            statusCode: 401,
          });
        }

        const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
        if (!tokenMatch) {
          auditLogger.logTokenExchangeFailure(
            request,
            'Authorization header must be in format "Bearer <token>"',
            'INVALID_AUTH_FORMAT'
          );
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Authorization header must be in format "Bearer <token>"',
            statusCode: 401,
          });
        }

        const providerToken = tokenMatch[1];
        if (!providerToken?.trim()) {
          auditLogger.logTokenExchangeFailure(
            request,
            'Provider token cannot be empty',
            'EMPTY_TOKEN'
          );
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Provider token cannot be empty',
            statusCode: 401,
          });
        }

        // Verify token with provider registry or fallback to legacy verification
        let claims: JWTClaims;
        let detectedProvider: AuthProvider;
        let registryProvider: string | undefined;
        try {
          if (providerRegistry && providerRegistry.size() > 0) {
            // Use provider registry for verification if providers are configured
            const result = await verifyTokenWithRegistry(
              providerToken,
              providerRegistry
            );
            claims = result.claims;
            registryProvider = result.provider;
            detectedProvider = mapRegistryProviderToAuthProvider(
              result.provider
            );
          } else if (isDevelopmentMode()) {
            // In development mode, fallback to legacy verification when no providers configured
            claims = fallbackTokenDecoding(providerToken);
            detectedProvider = detectProviderFromClaims(claims);
            registryProvider = 'development-fallback';
          } else {
            // In production mode, providers must be configured
            throw new Error('No authentication providers configured');
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          // Determine error type and provider for logging
          let errorType = 'UNKNOWN_ERROR';
          let detectedProvider: AuthProvider | undefined;

          // Handle provider registry errors
          if (
            error &&
            typeof error === 'object' &&
            'provider' in error &&
            'code' in error
          ) {
            const providerError = error as ProviderError;
            detectedProvider = mapRegistryProviderToAuthProvider(
              providerError.provider
            );
            errorType = providerError.code || 'VERIFICATION_FAILED';
          } else {
            // Try to detect provider from issuer in token for logging
            try {
              const parts = providerToken.split('.');
              if (parts.length === 3) {
                const payloadString = Buffer.from(
                  parts[1]!,
                  'base64url'
                ).toString('utf-8');
                const payload = JSON.parse(payloadString) as { iss?: string };
                if (payload.iss) {
                  const tempClaims = { iss: payload.iss } as JWTClaims;
                  detectedProvider = detectProviderFromClaims(tempClaims);
                }
              }
            } catch {
              // Ignore detection errors - will use undefined provider
            }
          }

          // Handle specific JWT errors with appropriate status codes
          if (errorMessage.includes('expired')) {
            errorType = 'TOKEN_EXPIRED';
            auditLogger.logJWTVerificationFailure(
              request,
              errorType,
              errorMessage,
              detectedProvider
            );
            return reply.code(401).send({
              error: 'TokenExpired',
              message: 'Provider token has expired',
              statusCode: 401,
            });
          }

          if (errorMessage.includes('signature')) {
            errorType = 'INVALID_SIGNATURE';
            auditLogger.logJWTVerificationFailure(
              request,
              errorType,
              errorMessage,
              detectedProvider
            );
            return reply.code(401).send({
              error: 'InvalidSignature',
              message: 'Token signature verification failed',
              statusCode: 401,
            });
          }

          if (errorMessage.includes('issuer')) {
            errorType = 'INVALID_ISSUER';
            auditLogger.logJWTVerificationFailure(
              request,
              errorType,
              errorMessage,
              detectedProvider
            );
            return reply.code(401).send({
              error: 'InvalidIssuer',
              message: 'Token issuer validation failed',
              statusCode: 401,
            });
          }

          if (errorMessage.includes('audience')) {
            errorType = 'INVALID_AUDIENCE';
            auditLogger.logJWTVerificationFailure(
              request,
              errorType,
              errorMessage,
              detectedProvider
            );
            return reply.code(401).send({
              error: 'InvalidAudience',
              message: 'Token audience validation failed',
              statusCode: 401,
            });
          }

          if (errorMessage.includes('not yet valid')) {
            errorType = 'TOKEN_NOT_YET_VALID';
            auditLogger.logJWTVerificationFailure(
              request,
              errorType,
              errorMessage,
              detectedProvider
            );
            return reply.code(401).send({
              error: 'TokenNotYetValid',
              message: 'Token is not yet valid',
              statusCode: 401,
            });
          }

          // Check if no configured provider found
          if (errorMessage.includes('No configured provider')) {
            errorType = 'NO_PROVIDER_CONFIGURED';
            auditLogger.logTokenExchangeFailure(
              request,
              errorMessage,
              errorType,
              detectedProvider
            );
            return reply.code(400).send({
              error: 'BadRequest',
              message: 'Unable to detect authentication provider from token',
              statusCode: 400,
            });
          }

          // Generic validation failure
          errorType = 'VERIFICATION_FAILED';
          auditLogger.logJWTVerificationFailure(
            request,
            errorType,
            errorMessage,
            detectedProvider
          );
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Token verification failed',
            statusCode: 401,
          });
        }

        // Extract user info from verified claims
        const userId = claims.sub;
        const email = claims.email;

        // Exchange token via auth gateway
        const sessionToken = await fastify.authGateway.exchangeToken(
          providerToken,
          detectedProvider,
          userId
        );

        // Record successful request
        rateLimiter.recordRequest(rateLimitKey, true);

        // Log successful exchange with audit logger
        auditLogger.logTokenExchangeSuccess(
          request,
          userId,
          detectedProvider,
          email,
          rateLimitResult.remaining - 1,
          15 // Session duration in minutes
        );

        // Additional logging for registry provider information
        fastify.log.info(
          {
            userId: userId.substring(0, 8) + '...',
            authProvider: detectedProvider,
            registryProvider: registryProvider || 'unknown',
            sessionDuration: 15,
            hasEmail: !!email,
          },
          'Token exchange completed via provider registry'
        );

        return reply.code(200).send({
          sessionToken: sessionToken.token,
          expiresAt: sessionToken.expiresAt.toISOString(),
          provider: sessionToken.provider,
        });
      } catch (error: unknown) {
        // Record failed request
        rateLimiter.recordRequest(rateLimitKey, false);

        // Log unexpected error with audit logger
        auditLogger.logTokenExchangeFailure(
          request,
          'An unexpected error occurred during token exchange',
          'INTERNAL_SERVER_ERROR'
        );

        // Log detailed error for debugging
        request.log.error(
          { error },
          'Token exchange failed with unexpected error'
        );

        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'An unexpected error occurred',
          statusCode: 500,
        });
      }
    }
  );
};

export default exchange;
