import type { FastifyPluginAsync } from 'fastify';
import {
  isDevelopmentMode,
  generateDevelopmentToken,
} from '../../../auth/jwt-verifier.js';
import { type JWTClaims } from '../../../types/auth.js';
import { AuthProvider } from '../../../plugins/auth-gateway.js';
import { createAuthAdapter, AuthAdapter } from '../../../auth/adapter.js';

/**
 * Enhanced token exchange route using the new infrastructure manager pattern
 * This demonstrates how to use the AuthAdapter for centralized infrastructure management
 *
 * Benefits of this approach:
 * - Centralized rate limiting, audit logging, and JWKS caching
 * - Consistent provider registry system
 * - Better separation of concerns
 * - Improved testability and monitoring
 */

const exchangeV2: FastifyPluginAsync = async (fastify): Promise<void> => {
  // Initialize auth adapter with infrastructure manager
  let authAdapter: AuthAdapter;

  try {
    authAdapter = createAuthAdapter(fastify.log);
  } catch (error) {
    fastify.log.error({ error }, 'Failed to initialize auth adapter');
    throw new Error('Authentication system initialization failed');
  }

  // Get infrastructure components
  const infrastructure = authAdapter.getInfrastructure();
  const auditLogger = authAdapter.getAuditLogger();
  const legacyVerifier = authAdapter.createLegacyVerifier();

  fastify.post(
    '/exchange/v2',
    {
      schema: {
        tags: ['Authentication'],
        summary:
          'Exchange provider token for session token (v2 - Infrastructure Manager)',
        description:
          'Enhanced token exchange using centralized infrastructure management. ' +
          'Provides improved rate limiting, audit logging, and provider registry integration.',
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            description: 'Token exchange successful',
            type: 'object',
            required: ['sessionToken', 'expiresAt', 'provider', 'metadata'],
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
              metadata: {
                type: 'object',
                description: 'Additional metadata about the exchange',
                properties: {
                  verificationMethod: { type: 'string' },
                  rateLimitRemaining: { type: 'number' },
                  infrastructureStats: { type: 'object' },
                },
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
      // Handle rate limiting using infrastructure manager
      const rateLimitInfo = authAdapter.handleRateLimit(request);

      // Set rate limit headers
      const context = infrastructure.getContext();
      const rateLimitMax = context.config.rateLimits?.exchange?.max || 10;
      reply.header('X-RateLimit-Limit', rateLimitMax.toString());
      reply.header(
        'X-RateLimit-Remaining',
        rateLimitInfo.result.remaining.toString()
      );
      reply.header(
        'X-RateLimit-Reset',
        new Date(rateLimitInfo.result.resetTime).toISOString()
      );

      // Check if rate limit exceeded
      if (!rateLimitInfo.allowed) {
        const retryAfterSeconds = Math.ceil(
          (rateLimitInfo.result.resetTime - Date.now()) / 1000
        );
        reply.header('Retry-After', retryAfterSeconds.toString());

        // Log rate limit violation
        auditLogger.logRateLimitExceeded(
          request,
          rateLimitInfo.result.totalHits,
          retryAfterSeconds,
          context.config.rateLimits?.exchange?.windowMs || 900000,
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
          rateLimitInfo.record(true);

          // Log development token generation
          auditLogger.logDevelopmentTokenGenerated(
            request,
            identifier,
            rateLimitInfo.result.remaining - 1
          );

          return reply.code(200).send({
            sessionToken: devToken,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
            provider: 'development',
            metadata: {
              verificationMethod: 'development',
              rateLimitRemaining: rateLimitInfo.result.remaining - 1,
              infrastructureStats: infrastructure.getStats(),
            },
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

        // Verify token using the new provider registry system
        let claims: JWTClaims;
        let detectedProvider: AuthProvider;
        let verificationMethod = 'provider-registry';

        try {
          // Try provider registry first (new method)
          const verificationResult = await authAdapter
            .getProviderRegistry()
            .verifyToken(providerToken);
          claims = verificationResult.claims;
          detectedProvider = AuthAdapter.detectProviderFromClaims(claims);

          fastify.log.info(
            {
              provider: verificationResult.provider,
              issuer: verificationResult.issuer,
              userId: claims.sub?.substring(0, 8) + '...',
            },
            'Token verified using provider registry'
          );
        } catch (error) {
          // Fallback to legacy verification for backward compatibility
          try {
            claims = await legacyVerifier(providerToken);
            detectedProvider = AuthAdapter.detectProviderFromClaims(claims);
            verificationMethod = 'legacy-fallback';

            fastify.log.warn(
              {
                error: error instanceof Error ? error.message : 'Unknown error',
                fallback: true,
              },
              'Provider registry failed, using legacy verification'
            );
          } catch (fallbackError) {
            const errorMessage =
              fallbackError instanceof Error
                ? fallbackError.message
                : 'Unknown error';

            // Determine error type for logging
            let errorType = 'UNKNOWN_ERROR';
            let detectedProviderForLog: AuthProvider | undefined;

            // Try to detect provider from token even if verification failed
            try {
              const providerType =
                AuthAdapter.detectProviderTypeFromToken(providerToken);
              if (providerType === 'clerk') {
                detectedProviderForLog = AuthProvider.CLERK;
              }
            } catch {
              // Ignore detection errors
            }

            // Handle specific JWT errors
            if (errorMessage.includes('expired')) {
              errorType = 'TOKEN_EXPIRED';
              auditLogger.logJWTVerificationFailure(
                request,
                errorType,
                errorMessage,
                detectedProviderForLog
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
                detectedProviderForLog
              );
              return reply.code(401).send({
                error: 'InvalidSignature',
                message: 'Token signature verification failed',
                statusCode: 401,
              });
            }

            // Generic verification failure
            errorType = 'VERIFICATION_FAILED';
            auditLogger.logJWTVerificationFailure(
              request,
              errorType,
              errorMessage,
              detectedProviderForLog
            );
            return reply.code(401).send({
              error: 'Unauthorized',
              message: 'Token verification failed',
              statusCode: 401,
            });
          }
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
        rateLimitInfo.record(true);

        // Log successful exchange
        auditLogger.logTokenExchangeSuccess(
          request,
          userId,
          detectedProvider,
          email,
          rateLimitInfo.result.remaining - 1,
          15 // Session duration in minutes
        );

        return reply.code(200).send({
          sessionToken: sessionToken.token,
          expiresAt: sessionToken.expiresAt.toISOString(),
          provider: sessionToken.provider,
          metadata: {
            verificationMethod,
            rateLimitRemaining: rateLimitInfo.result.remaining - 1,
            infrastructureStats: infrastructure.getStats(),
          },
        });
      } catch (error: unknown) {
        // Record failed request
        rateLimitInfo.record(false);

        // Log unexpected error
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

  // Add health check endpoint for infrastructure monitoring
  fastify.get(
    '/exchange/v2/health',
    {
      schema: {
        tags: ['Authentication', 'Health'],
        summary: 'Health check for auth infrastructure',
        description:
          'Returns status and statistics of auth infrastructure components',
        response: {
          200: {
            description: 'Infrastructure health status',
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              infrastructure: { type: 'object' },
              providerRegistry: { type: 'object' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const stats = authAdapter.getStats();

      return reply.code(200).send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        infrastructure: stats.infrastructure,
        providerRegistry: stats.providerRegistry,
      });
    }
  );
};

export default exchangeV2;
