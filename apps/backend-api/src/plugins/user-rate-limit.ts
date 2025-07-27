import fp from 'fastify-plugin';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userRateLimiters?: {
      request: RateLimiterMemory;
      token: RateLimiterMemory;
    };
  }
}

export interface UsageInfo {
  tokens?: {
    used: number;
    remaining: number;
    limit: number;
    resetAt: string;
  };
  requests: {
    used: number;
    remaining: number;
    limit: number;
    resetAt: string;
  };
}

export default fp(
  async function userRateLimit(fastify: FastifyInstance) {
    const config = fastify.config!;

    // Create rate limiters for authenticated users
    const requestLimiter = new RateLimiterMemory({
      keyPrefix: 'req',
      points: config.REQUEST_LIMIT_MAX,
      duration: Math.floor(config.REQUEST_LIMIT_TIME_WINDOW / 1000), // Convert to seconds
    });

    const tokenLimiter = new RateLimiterMemory({
      keyPrefix: 'token',
      points: config.TOKEN_LIMIT_MAX || 1, // Use 1 if disabled to avoid errors
      duration: Math.floor(config.TOKEN_LIMIT_TIME_WINDOW / 1000), // Convert to seconds
    });

    // Attach limiters to request for use in routes
    // @ts-expect-error - Fastify decorateRequest type issue
    fastify.decorateRequest('userRateLimiters', null);

    fastify.addHook('onRequest', async (request: FastifyRequest) => {
      request.userRateLimiters = {
        request: requestLimiter,
        token: tokenLimiter,
      };
    });

    // Helper function to check user rate limits (for authenticated routes)
    fastify.decorate(
      'checkUserRateLimit',
      async (request: FastifyRequest, reply: FastifyReply) => {
        // Skip if no JWT (will be handled by auth middleware)
        if (!request.user) {
          return;
        }

        const userId = (request.user as { userId: string }).userId;

        // Check if request would exceed limit (atomic check-and-reject pattern)
        const limiterRes = await requestLimiter.get(userId);
        const currentUsed = limiterRes ? limiterRes.consumedPoints : 0;

        if (currentUsed >= config.REQUEST_LIMIT_MAX) {
          const resetAt = limiterRes
            ? new Date(Date.now() + limiterRes.msBeforeNext).toISOString()
            : new Date(
                Date.now() + config.REQUEST_LIMIT_TIME_WINDOW
              ).toISOString();

          const usage = await getUserUsage(
            userId,
            requestLimiter,
            tokenLimiter
          );

          reply.code(429).send({
            error: 'RequestLimitExceeded',
            message: `Request limit exceeded. Resets at ${resetAt}`,
            usage,
          });
          throw new Error('Rate limit exceeded');
        }

        // Only consume if under limit
        await requestLimiter.consume(userId, 1);
      }
    );

    // Helper function to consume tokens
    fastify.decorate(
      'consumeTokens',
      async (userId: string, tokens: number): Promise<void> => {
        // Skip token consumption if TOKEN_LIMIT_MAX is 0 (disabled)
        if (config.TOKEN_LIMIT_MAX === 0) {
          return;
        }

        // Check if request would exceed limit (atomic check-and-reject pattern)
        const limiterRes = await tokenLimiter.get(userId);
        const currentUsed = limiterRes ? limiterRes.consumedPoints : 0;

        if (currentUsed + tokens > config.TOKEN_LIMIT_MAX) {
          const resetAt = limiterRes
            ? new Date(Date.now() + limiterRes.msBeforeNext).toISOString()
            : new Date(
                Date.now() + config.TOKEN_LIMIT_TIME_WINDOW
              ).toISOString();

          const usage = await getUserUsage(
            userId,
            requestLimiter,
            tokenLimiter
          );

          const error = fastify.httpErrors.tooManyRequests(
            `Token limit exceeded. Resets at ${resetAt}`
          );
          // Add usage info to error for better debugging
          (error as { usage?: UsageInfo }).usage = usage;
          throw error;
        }

        // Only consume if under limit
        await tokenLimiter.consume(userId, tokens);
      }
    );

    // Helper function to get current usage
    fastify.decorate(
      'getUserUsage',
      async (userId: string): Promise<UsageInfo> => {
        return getUserUsage(userId, requestLimiter, tokenLimiter);
      }
    );

    async function getUserUsage(
      userId: string,
      requestLimiter: RateLimiterMemory,
      tokenLimiter: RateLimiterMemory
    ): Promise<UsageInfo> {
      const [requestRes, tokenRes] = await Promise.all([
        requestLimiter.get(userId),
        tokenLimiter.get(userId),
      ]);

      const now = Date.now();

      const result: UsageInfo = {
        requests: {
          used: requestRes ? requestRes.consumedPoints : 0,
          remaining: requestRes
            ? Math.max(0, config.REQUEST_LIMIT_MAX - requestRes.consumedPoints)
            : config.REQUEST_LIMIT_MAX,
          limit: config.REQUEST_LIMIT_MAX,
          resetAt: requestRes
            ? new Date(now + requestRes.msBeforeNext).toISOString()
            : new Date(now + config.REQUEST_LIMIT_TIME_WINDOW).toISOString(),
        },
        tokens: {
          used: tokenRes ? tokenRes.consumedPoints : 0,
          remaining: tokenRes
            ? Math.max(0, config.TOKEN_LIMIT_MAX - tokenRes.consumedPoints)
            : config.TOKEN_LIMIT_MAX,
          limit: config.TOKEN_LIMIT_MAX,
          resetAt: tokenRes
            ? new Date(now + tokenRes.msBeforeNext).toISOString()
            : new Date(now + config.TOKEN_LIMIT_TIME_WINDOW).toISOString(),
        },
      };

      // If token rate limiting is disabled, omit the tokens field
      if (config.TOKEN_LIMIT_MAX === 0) {
        delete result.tokens;
      }

      return result;
    }

    // Add rate limit headers to responses for authenticated users
    fastify.addHook(
      'onSend',
      async (request: FastifyRequest, reply, payload) => {
        // Only add headers for authenticated requests
        if (!request.user) {
          return payload;
        }

        const userId = (request.user as { userId: string }).userId;

        // Get current usage
        const [requestRes, tokenRes] = await Promise.all([
          requestLimiter.get(userId),
          tokenLimiter.get(userId),
        ]);

        const now = Date.now();

        // Add request rate limit headers
        const requestsUsed = requestRes ? requestRes.consumedPoints : 0;
        const requestsRemaining = Math.max(
          0,
          config.REQUEST_LIMIT_MAX - requestsUsed
        );
        const requestsReset = requestRes
          ? Math.floor((now + requestRes.msBeforeNext) / 1000)
          : Math.floor((now + config.REQUEST_LIMIT_TIME_WINDOW) / 1000);

        reply.header('X-RateLimit-Requests-Limit', config.REQUEST_LIMIT_MAX);
        reply.header('X-RateLimit-Requests-Remaining', requestsRemaining);
        reply.header('X-RateLimit-Requests-Reset', requestsReset);

        // Add token rate limit headers only if token rate limiting is enabled
        if (config.TOKEN_LIMIT_MAX > 0) {
          const tokensUsed = tokenRes ? tokenRes.consumedPoints : 0;
          const tokensRemaining = Math.max(
            0,
            config.TOKEN_LIMIT_MAX - tokensUsed
          );
          const tokensReset = tokenRes
            ? Math.floor((now + tokenRes.msBeforeNext) / 1000)
            : Math.floor((now + config.TOKEN_LIMIT_TIME_WINDOW) / 1000);

          reply.header('X-RateLimit-Tokens-Limit', config.TOKEN_LIMIT_MAX);
          reply.header('X-RateLimit-Tokens-Remaining', tokensRemaining);
          reply.header('X-RateLimit-Tokens-Reset', tokensReset);
        }

        return payload;
      }
    );
  },
  {
    name: 'user-rate-limit',
    dependencies: ['env-plugin'],
  }
);

// Extend Fastify instance with our custom methods
declare module 'fastify' {
  interface FastifyInstance {
    checkUserRateLimit: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    consumeTokens: (userId: string, tokens: number) => Promise<void>;
    getUserUsage: (userId: string) => Promise<UsageInfo>;
  }
}
