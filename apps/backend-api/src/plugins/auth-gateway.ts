import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SessionCache } from '../utils/cache.js';
import { randomBytes } from 'node:crypto';
import {
  detectProvider,
  validateProviderToken as validateProviderTokenUtil,
  AuthProviderError,
} from '../utils/auth-providers.js';

// Simplified configuration schema - only cache and session settings
const AuthGatewayOptionsSchema = z.object({
  cache: z
    .object({
      maxSize: z.number().positive().default(1000),
      ttl: z.number().positive().default(3600000), // 1 hour in ms
    })
    .optional()
    .default({}),
  session: z
    .object({
      maxAge: z.number().positive().default(3600000), // 1 hour in ms
      cleanupInterval: z.number().positive().default(600000), // 10 minutes in ms
    })
    .optional()
    .default({}),
});

export type AuthGatewayOptions = z.infer<typeof AuthGatewayOptionsSchema>;

export enum AuthProvider {
  CLERK = 'clerk',
  AUTH0 = 'auth0',
  SUPABASE = 'supabase',
  FIREBASE = 'firebase',
  INTERNAL = 'internal',
}

export interface SessionToken {
  token: string;
  userId: string;
  provider: AuthProvider;
  createdAt: Date;
  expiresAt: Date;
}

export interface ProviderTokenValidationResult {
  isValid: boolean;
  userId?: string;
  email?: string;
  provider?: AuthProvider;
  error?: string;
}

export interface AuthMetrics {
  exchanges: {
    total: number;
    byProvider: Record<string, number>;
    failures: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  sessions: {
    active: number;
    created: number;
    invalidated: number;
  };
}

// Extend Fastify instance with simplified auth gateway methods
declare module 'fastify' {
  interface FastifyInstance {
    authGateway: {
      validateToken: (token: string) => Promise<SessionToken | null>;
      createSession: (
        userId: string,
        provider: AuthProvider
      ) => Promise<SessionToken>;
      invalidateSession: (token: string) => Promise<void>;
      getSession: (token: string) => Promise<SessionToken | null>;
      exchangeToken: (
        providerToken: string,
        provider: AuthProvider,
        userId: string
      ) => Promise<SessionToken>;
      getMetrics: () => AuthMetrics;
    };
  }
}

export default fp(
  async function authGateway(
    fastify: FastifyInstance,
    opts: Partial<AuthGatewayOptions> = {}
  ) {
    // Validate configuration with defaults
    const config = AuthGatewayOptionsSchema.parse(opts || {});

    // Metrics tracking state
    const metrics = {
      exchanges: {
        total: 0,
        byProvider: {} as Record<string, number>,
        failures: 0,
      },
      cache: {
        hits: 0,
        misses: 0,
      },
      sessions: {
        created: 0,
        invalidated: 0,
      },
    };

    // Initialize SessionCache with metrics-aware logging
    const sessionCache = new SessionCache(
      {
        max: config.cache.maxSize,
        ttl: config.session.maxAge,
        updateAgeOnGet: false,
        updateAgeOnHas: false,
      },
      (message: string, meta?: object) => {
        // Track cache hits and misses
        if (message === 'Cache hit') {
          metrics.cache.hits++;
        } else if (message === 'Cache miss') {
          metrics.cache.misses++;
        }

        fastify.log.debug(meta || {}, `SessionCache: ${message}`);
      }
    );

    // Helper function to generate secure session token
    const generateSessionToken = (): string => {
      return randomBytes(32).toString('base64url');
    };

    // Simple token-to-user mapping for session lookup with size limit
    const MAX_TOKEN_MAP_SIZE = config.cache.maxSize * 2; // Double cache size as safety buffer
    const tokenToUserMap = new Map<
      string,
      { userId: string; provider: AuthProvider; createdAt: number }
    >();

    // Helper function to enforce token map size limit
    const enforceTokenMapSizeLimit = (): void => {
      if (tokenToUserMap.size >= MAX_TOKEN_MAP_SIZE) {
        // Remove oldest 25% of tokens to prevent frequent cleanup
        const tokensToRemove = Math.floor(MAX_TOKEN_MAP_SIZE * 0.25);
        const sortedTokens = Array.from(tokenToUserMap.entries()).sort(
          ([, a], [, b]) => a.createdAt - b.createdAt
        );

        const tokensToRemoveArray = sortedTokens.slice(0, tokensToRemove);
        tokensToRemoveArray.forEach(([token]) => {
          tokenToUserMap.delete(token);
        });

        if (tokensToRemoveArray.length > 0) {
          fastify.log.debug(
            {
              removedTokens: tokensToRemoveArray.length,
              currentSize: tokenToUserMap.size,
              maxSize: MAX_TOKEN_MAP_SIZE,
            },
            'Enforced token map size limit by removing oldest tokens'
          );
        }
      }
    };

    // Helper function to safely increment provider metrics
    const incrementProviderCount = (provider: AuthProvider): void => {
      switch (provider) {
        case AuthProvider.CLERK:
          metrics.exchanges.byProvider['clerk'] =
            (metrics.exchanges.byProvider['clerk'] ?? 0) + 1;
          break;
        case AuthProvider.AUTH0:
          metrics.exchanges.byProvider['auth0'] =
            (metrics.exchanges.byProvider['auth0'] ?? 0) + 1;
          break;
        case AuthProvider.SUPABASE:
          metrics.exchanges.byProvider['supabase'] =
            (metrics.exchanges.byProvider['supabase'] ?? 0) + 1;
          break;
        case AuthProvider.FIREBASE:
          metrics.exchanges.byProvider['firebase'] =
            (metrics.exchanges.byProvider['firebase'] ?? 0) + 1;
          break;
        case AuthProvider.INTERNAL:
          metrics.exchanges.byProvider['internal'] =
            (metrics.exchanges.byProvider['internal'] ?? 0) + 1;
          break;
        default:
          // Handle unknown providers by using a safe fallback
          break;
      }
    };

    // Simplified auth gateway methods
    const authGateway = {
      validateToken: async (token: string): Promise<SessionToken | null> => {
        try {
          if (!token || token.trim() === '') {
            return null;
          }

          // Quick cleanup check on every 10th validation to prevent accumulation
          if (Math.random() < 0.1) {
            const now = new Date();
            const expiredTokens: string[] = [];

            tokenToUserMap.forEach((userInfo, mapToken) => {
              const session = sessionCache.getSession(
                userInfo.userId,
                userInfo.provider
              );
              if (!session || session.expiresAt <= now) {
                expiredTokens.push(mapToken);
              }
            });

            if (expiredTokens.length > 0) {
              expiredTokens.forEach(expiredToken =>
                tokenToUserMap.delete(expiredToken)
              );
              fastify.log.debug(
                { cleanedExpiredTokens: expiredTokens.length },
                'Opportunistically cleaned expired tokens during validation'
              );
            }
          }

          const userInfo = tokenToUserMap.get(token);
          if (!userInfo) {
            return null;
          }

          const session = sessionCache.getSession(
            userInfo.userId,
            userInfo.provider
          );
          if (!session || session.token !== token) {
            tokenToUserMap.delete(token);
            return null;
          }

          fastify.log.debug(
            { userId: session.userId, provider: session.provider },
            'Token validated successfully'
          );

          return session;
        } catch (error) {
          fastify.log.error(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            'Error validating token'
          );
          return null;
        }
      },

      createSession: async (
        userId: string,
        provider: AuthProvider
      ): Promise<SessionToken> => {
        if (!userId || userId.trim() === '') {
          throw new Error('userId is required');
        }

        const token = generateSessionToken();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + config.session.maxAge);

        const sessionToken: SessionToken = {
          token,
          userId,
          provider,
          createdAt: now,
          expiresAt,
        };

        sessionCache.setSession(sessionToken);

        // Enforce size limit before adding new token
        enforceTokenMapSizeLimit();

        tokenToUserMap.set(token, {
          userId,
          provider,
          createdAt: now.getTime(),
        });

        // Track session creation
        metrics.sessions.created++;

        fastify.log.debug(
          { userId, provider, expiresAt },
          'Session created successfully'
        );

        return sessionToken;
      },

      invalidateSession: async (token: string): Promise<void> => {
        if (!token || token.trim() === '') {
          return;
        }

        const userInfo = tokenToUserMap.get(token);
        if (userInfo) {
          sessionCache.deleteSession(userInfo.userId, userInfo.provider);

          // Track session invalidation
          metrics.sessions.invalidated++;

          fastify.log.debug(
            { userId: userInfo.userId, provider: userInfo.provider },
            'Session invalidated'
          );
        }

        tokenToUserMap.delete(token);
      },

      getSession: async (token: string): Promise<SessionToken | null> => {
        // Same logic as validateToken for simplicity
        return authGateway.validateToken(token);
      },

      exchangeToken: async (
        providerToken: string,
        provider: AuthProvider,
        userId: string
      ): Promise<SessionToken> => {
        if (!providerToken || providerToken.trim() === '') {
          throw new Error('providerToken is required');
        }
        if (!userId || userId.trim() === '') {
          throw new Error('userId is required');
        }

        try {
          // Track exchange attempt
          metrics.exchanges.total++;

          // Track provider-specific exchange count safely
          incrementProviderCount(provider);

          // Validate provider token with real JWT verification
          const validationResult = await validateProviderToken(
            providerToken,
            provider
          );
          if (!validationResult.isValid) {
            // Track exchange failure
            metrics.exchanges.failures++;

            const error = `Invalid provider token: ${validationResult.error || 'Unknown validation error'}`;
            fastify.log.warn(
              {
                provider,
                userId: userId.substring(0, 8) + '...',
                validationError: validationResult.error,
              },
              'Token exchange failed - invalid provider token'
            );
            throw new Error(error);
          }

          // Verify the userId from token matches the provided userId (strict validation)
          if (!validationResult.userId || validationResult.userId !== userId) {
            // Track exchange failure
            metrics.exchanges.failures++;

            fastify.log.warn(
              {
                provider,
                providedUserId: userId.substring(0, 8) + '...',
                tokenUserId: validationResult.userId
                  ? validationResult.userId.substring(0, 8) + '...'
                  : 'undefined',
              },
              'Token exchange failed - userId mismatch'
            );
            throw new Error(
              'User ID mismatch between token and provided parameter'
            );
          }

          // Use the validated userId from the token if not provided
          const validatedUserId = validationResult.userId || userId;

          // Check for existing valid session
          const existingSession = sessionCache.getSession(
            validatedUserId,
            provider
          );
          if (existingSession && existingSession.expiresAt > new Date()) {
            fastify.log.debug(
              {
                userId: validatedUserId.substring(0, 8) + '...',
                provider,
                hasEmail: !!validationResult.email,
              },
              'Returning existing valid session'
            );
            return existingSession;
          }

          // Create new session
          const sessionToken = await authGateway.createSession(
            validatedUserId,
            provider
          );

          fastify.log.info(
            {
              userId: validatedUserId.substring(0, 8) + '...',
              provider,
              expiresAt: sessionToken.expiresAt,
              hasEmail: !!validationResult.email,
            },
            'Provider token exchanged for session token'
          );

          return sessionToken;
        } catch (error) {
          // Track exchange failure if not already tracked
          if (
            !(error instanceof Error) ||
            (!error.message.includes('Invalid provider token') &&
              !error.message.includes('User ID mismatch'))
          ) {
            metrics.exchanges.failures++;
          }
          throw error;
        }
      },

      getMetrics: (): AuthMetrics => {
        const totalCacheOperations = metrics.cache.hits + metrics.cache.misses;
        const hitRate =
          totalCacheOperations > 0
            ? metrics.cache.hits / totalCacheOperations
            : 0;

        return {
          exchanges: {
            total: metrics.exchanges.total,
            byProvider: { ...metrics.exchanges.byProvider },
            failures: metrics.exchanges.failures,
          },
          cache: {
            hits: metrics.cache.hits,
            misses: metrics.cache.misses,
            hitRate: Number(hitRate.toFixed(4)), // Round to 4 decimal places
          },
          sessions: {
            active: sessionCache.size(), // Current number of active sessions
            created: metrics.sessions.created,
            invalidated: metrics.sessions.invalidated,
          },
        };
      },
    };

    // Provider token validation using JWT verification
    async function validateProviderToken(
      token: string,
      expectedProvider?: AuthProvider
    ): Promise<ProviderTokenValidationResult> {
      try {
        if (!token || token.trim() === '') {
          fastify.log.warn('Empty provider token provided');
          return {
            isValid: false,
            error: 'Token is required and cannot be empty',
          };
        }

        fastify.log.debug(
          {
            expectedProvider,
            tokenLength: token.length,
            tokenPrefix: token.substring(0, 20) + '...',
          },
          'Starting provider token validation'
        );

        // First detect the provider from the token
        const detectedProvider = detectProvider(token);
        if (detectedProvider === 'unknown') {
          fastify.log.warn(
            { tokenPrefix: token.substring(0, 20) + '...' },
            'Unable to detect authentication provider from token'
          );
          return {
            isValid: false,
            error: 'Unable to detect authentication provider from token',
          };
        }

        // If an expected provider was specified, verify it matches
        if (expectedProvider && detectedProvider !== expectedProvider) {
          fastify.log.warn(
            {
              detectedProvider,
              expectedProvider,
              tokenPrefix: token.substring(0, 20) + '...',
            },
            'Provider mismatch - detected provider does not match expected'
          );
          return {
            isValid: false,
            error: `Provider mismatch: expected ${expectedProvider}, detected ${detectedProvider}`,
          };
        }

        // Validate the token using the auth-providers utility (simplified, no longer async)
        const validationResult = validateProviderTokenUtil(
          token,
          fastify.config
        );

        fastify.log.info(
          {
            provider: validationResult.provider,
            userId: validationResult.userId.substring(0, 8) + '...',
            hasEmail: !!validationResult.email,
          },
          'Provider token validated successfully'
        );

        return {
          isValid: true,
          userId: validationResult.userId,
          ...(validationResult.email && { email: validationResult.email }),
          provider: validationResult.provider,
        };
      } catch (error) {
        // Handle specific AuthProviderError with detailed logging
        if (error instanceof AuthProviderError) {
          fastify.log.warn(
            {
              provider: error.provider,
              error: error.message,
              tokenPrefix: token.substring(0, 20) + '...',
            },
            'Provider-specific token validation failed'
          );
          return {
            isValid: false,
            provider: error.provider,
            error: error.message,
          };
        }

        // Handle other validation errors
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown validation error';
        fastify.log.error(
          {
            error: errorMessage,
            tokenPrefix: token.substring(0, 20) + '...',
            expectedProvider,
          },
          'Unexpected error during provider token validation'
        );

        return {
          isValid: false,
          error: errorMessage,
        };
      }
    }

    // Decorate Fastify instance
    fastify.decorate('authGateway', authGateway);

    // Set up cleanup interval for expired sessions
    const cleanupInterval = setInterval(() => {
      try {
        const cleanedCount = sessionCache.cleanExpired();

        if (cleanedCount > 0) {
          // Track cleaned sessions as invalidations
          metrics.sessions.invalidated += cleanedCount;
          fastify.log.debug(
            { cleanedSessions: cleanedCount },
            'Cleaned up expired sessions'
          );
        }

        // Clean up token mapping for expired sessions
        let tokenMappingCleaned = 0;
        const now = new Date();

        const tokensToDelete: string[] = [];
        tokenToUserMap.forEach((userInfo, token) => {
          const session = sessionCache.getSession(
            userInfo.userId,
            userInfo.provider
          );
          if (!session || session.expiresAt <= now) {
            tokensToDelete.push(token);
          }
        });

        tokensToDelete.forEach(token => {
          tokenToUserMap.delete(token);
          tokenMappingCleaned++;
        });

        if (tokenMappingCleaned > 0) {
          fastify.log.debug(
            { cleanedTokenMappings: tokenMappingCleaned },
            'Cleaned up expired token mappings'
          );
        }
      } catch (error) {
        fastify.log.error(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          'Error during session cleanup'
        );
      }
    }, config.session.cleanupInterval);

    // Clean up on server close
    fastify.addHook('onClose', async () => {
      try {
        clearInterval(cleanupInterval);
        sessionCache.clear();
        tokenToUserMap.clear();

        fastify.log.info('Auth Gateway plugin cleaned up successfully');
      } catch (error) {
        fastify.log.error(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          'Error during Auth Gateway cleanup'
        );
      }
    });

    fastify.log.info(
      {
        cacheConfig: config.cache,
        sessionConfig: config.session,
        supportedProviders: Object.values(AuthProvider),
        sessionCacheStats: sessionCache.getSessionStats(),
      },
      'Auth Gateway plugin initialized successfully'
    );
  },
  {
    name: 'auth-gateway-plugin',
    dependencies: ['env-plugin'],
  }
);
