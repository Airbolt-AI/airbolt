import fastifyRateLimit, {
  type RateLimitPluginOptions,
} from '@fastify/rate-limit';
import fp from 'fastify-plugin';

export default fp(
  async fastify => {
    if (!fastify.config) {
      throw new Error(
        'Configuration plugin must be registered before rate-limit plugin'
      );
    }

    const rateLimitOptions: RateLimitPluginOptions = {
      max: fastify.config.RATE_LIMIT_MAX,
      timeWindow: fastify.config.RATE_LIMIT_TIME_WINDOW,
      // Add rate limit headers to all responses
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
      },
      // Add headers when approaching the limit
      addHeadersOnExceeding: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
      },
      errorResponseBuilder: (_request, context) => {
        return {
          error: 'RateLimitExceeded',
          message: `You have exceeded the allowed number of requests. Try again in ${context.after}.`,
          statusCode: 429,
        };
      },
      hook: 'onRequest',
      keyGenerator: request => {
        // Only trust X-Forwarded-For header if TRUST_PROXY is enabled
        const forwardedFor = request.headers['x-forwarded-for'];
        if (fastify.config?.TRUST_PROXY && forwardedFor) {
          // Handle both string and array cases
          const forwardedIp: string | undefined = Array.isArray(forwardedFor)
            ? forwardedFor[0]
            : forwardedFor;
          if (forwardedIp) {
            const firstIp = forwardedIp.split(',')[0];
            return firstIp ? firstIp.trim() : 'anonymous';
          }
        }

        // Otherwise use the direct IP address
        return request.ip ?? 'anonymous';
      },
    };

    await fastify.register(fastifyRateLimit, rateLimitOptions);

    fastify.log.info(
      {
        max: fastify.config.RATE_LIMIT_MAX,
        timeWindow: `${fastify.config.RATE_LIMIT_TIME_WINDOW}ms`,
      },
      'Rate limiting configured'
    );
  },
  {
    name: 'rate-limit-plugin',
    dependencies: ['env-plugin'],
  }
);
