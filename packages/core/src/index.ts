import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import AutoLoad from '@fastify/autoload';
import fastifyJwt from '@fastify/jwt';
import fastifySse from 'fastify-sse-v2';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import sensiblePlugin from './plugins/sensible.js';
import supportPlugin from './plugins/support.js';
import aiProviderService from './services/ai-provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface CoreOptions {
  // Required options
  jwtSecret: string;
  getApiKey: (provider: string, userId?: string) => Promise<string> | string;

  // Optional with defaults
  allowedOrigins?: string[];
  systemPrompt?: string;
  rateLimitMax?: number;
  rateLimitTimeWindow?: number;
  trustProxy?: boolean;

  // Token/request limits
  tokenLimitMax?: number;
  tokenLimitTimeWindow?: number;
  requestLimitMax?: number;
  requestLimitTimeWindow?: number;

  // External JWT config
  externalJwtIssuer?: string;
  externalJwtPublicKey?: string;
  externalJwtSecret?: string;
  externalJwtAudience?: string;
}

async function airboltCore(
  fastify: FastifyInstance,
  options: CoreOptions
): Promise<void> {
  // Create a config object that mimics the env plugin's output
  const config = {
    JWT_SECRET: options.jwtSecret,
    ALLOWED_ORIGIN: options.allowedOrigins || ['*'],
    ...(options.systemPrompt ? { SYSTEM_PROMPT: options.systemPrompt } : {}),
    RATE_LIMIT_MAX: options.rateLimitMax || 60,
    RATE_LIMIT_TIME_WINDOW: options.rateLimitTimeWindow || 60000,
    TRUST_PROXY: options.trustProxy || false,
    TOKEN_LIMIT_MAX: options.tokenLimitMax || 100000,
    TOKEN_LIMIT_TIME_WINDOW: options.tokenLimitTimeWindow || 3600000,
    REQUEST_LIMIT_MAX: options.requestLimitMax || 100,
    REQUEST_LIMIT_TIME_WINDOW: options.requestLimitTimeWindow || 3600000,
    ...(options.externalJwtIssuer
      ? { EXTERNAL_JWT_ISSUER: options.externalJwtIssuer }
      : {}),
    ...(options.externalJwtPublicKey
      ? { EXTERNAL_JWT_PUBLIC_KEY: options.externalJwtPublicKey }
      : {}),
    ...(options.externalJwtSecret
      ? { EXTERNAL_JWT_SECRET: options.externalJwtSecret }
      : {}),
    ...(options.externalJwtAudience
      ? { EXTERNAL_JWT_AUDIENCE: options.externalJwtAudience }
      : {}),
    AI_PROVIDER: 'openai',
  };

  // Decorate fastify with config if it doesn't already exist
  if (!fastify.hasDecorator('config')) {
    fastify.decorate('config', config);
  }

  // Register CORS plugin
  await fastify.register(fastifyCors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl, Postman)
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins = config.ALLOWED_ORIGIN;

      // Check if origins are properly configured
      if (!Array.isArray(allowedOrigins)) {
        fastify.log.error({ allowedOrigins }, 'ALLOWED_ORIGIN is not an array');
        callback(new Error('CORS configuration error'), false);
        return;
      }

      // Check if origin is allowed
      const isAllowed =
        allowedOrigins.includes('*') || allowedOrigins.includes(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  });

  // Register rate limit plugin
  const rateLimitOpts = {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_TIME_WINDOW,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    keyGenerator: (request: FastifyRequest) => {
      const req = request as FastifyRequest & { ip: string };
      return req.ip;
    },
    errorResponseBuilder: (
      _request: FastifyRequest,
      context: { max: number; after: string; ttl: number }
    ) => ({
      error: 'TooManyRequests',
      message: `Rate limit exceeded. Max ${context.max} requests per ${context.after}`,
      statusCode: 429,
      retryAfter: context.ttl,
    }),
    onExceeding: (request: FastifyRequest, key: string) => {
      request.log.warn({ key, url: request.url }, 'Rate limit approaching');
    },
    onExceeded: (request: FastifyRequest, key: string) => {
      request.log.warn({ key, url: request.url }, 'Rate limit exceeded');
    },
  };

  if (config.TRUST_PROXY) {
    Object.assign(rateLimitOpts, { trustProxy: true });
  }

  await fastify.register(fastifyRateLimit, rateLimitOpts);

  // Register user rate limit plugin (inline)
  const requestLimiter = new RateLimiterMemory({
    keyPrefix: 'req',
    points: config.REQUEST_LIMIT_MAX,
    duration: Math.floor(config.REQUEST_LIMIT_TIME_WINDOW / 1000),
  });

  const tokenLimiter = new RateLimiterMemory({
    keyPrefix: 'token',
    points: config.TOKEN_LIMIT_MAX || 1,
    duration: Math.floor(config.TOKEN_LIMIT_TIME_WINDOW / 1000),
  });

  // @ts-expect-error - Fastify decorateRequest type issue
  fastify.decorateRequest('userRateLimiters', null);

  fastify.addHook('onRequest', async request => {
    request.userRateLimiters = { request: requestLimiter, token: tokenLimiter };
  });

  // Decorate with helper functions
  fastify.decorate(
    'consumeUserTokens',
    async function (userId: string, tokens: number) {
      if (!config.TOKEN_LIMIT_MAX || config.TOKEN_LIMIT_MAX === 0) return;
      try {
        await tokenLimiter.consume(userId, tokens);
      } catch (error) {
        const usageError = new Error(`Token limit exceeded for user ${userId}`);
        Object.assign(usageError, {
          statusCode: 429,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          usage: await getUserUsage(userId),
        });
        throw usageError;
      }
    }
  );

  async function getUserUsage(userId: string) {
    const [tokenStatus, requestStatus] = await Promise.all([
      tokenLimiter.get(userId),
      requestLimiter.get(userId),
    ]);

    const now = Date.now();
    const usage: any = {
      requests: {
        used: requestStatus?.consumedPoints || 0,
        remaining: requestStatus
          ? requestStatus.remainingPoints
          : config.REQUEST_LIMIT_MAX,
        limit: config.REQUEST_LIMIT_MAX,
        resetAt: new Date(
          now +
            (requestStatus?.msBeforeNext || config.REQUEST_LIMIT_TIME_WINDOW)
        ).toISOString(),
      },
    };

    if (config.TOKEN_LIMIT_MAX && config.TOKEN_LIMIT_MAX > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const typedUsage = usage;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      typedUsage.tokens = {
        used: tokenStatus?.consumedPoints || 0,
        remaining: tokenStatus
          ? tokenStatus.remainingPoints
          : config.TOKEN_LIMIT_MAX,
        limit: config.TOKEN_LIMIT_MAX,
        resetAt: new Date(
          now + (tokenStatus?.msBeforeNext || config.TOKEN_LIMIT_TIME_WINDOW)
        ).toISOString(),
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return usage;
  }

  fastify.decorate('getUserUsage', getUserUsage);

  fastify.decorate(
    'checkUserRateLimit',
    async function (request: FastifyRequest, _reply: FastifyReply) {
      const user = request.user as { userId: string };
      if (!user?.userId) {
        throw fastify.httpErrors.unauthorized('User not authenticated');
      }

      try {
        await requestLimiter.consume(user.userId);
      } catch (error) {
        const err = fastify.httpErrors.tooManyRequests(
          'Request limit exceeded'
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const errorWithUsage = err as any;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        errorWithUsage.usage = await getUserUsage(user.userId);
        throw errorWithUsage;
      }
    }
  );

  // Register SSE plugin for streaming
  await fastify.register(fastifySse);

  // Register JWT plugin
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: {
      algorithm: 'HS256',
      expiresIn: '15m',
      iss: 'airbolt-api',
    },
    verify: {
      allowedIss: 'airbolt-api',
    },
  });

  // Register external JWT namespace if configured
  if (config.EXTERNAL_JWT_PUBLIC_KEY || config.EXTERNAL_JWT_SECRET) {
    await fastify.register(fastifyJwt, {
      namespace: 'external',
      secret:
        config.EXTERNAL_JWT_PUBLIC_KEY || config.EXTERNAL_JWT_SECRET || '',
      verify: {
        algorithms: config.EXTERNAL_JWT_PUBLIC_KEY ? ['RS256'] : ['HS256'],
      },
    });
  }

  // Register AI provider service with dynamic configuration
  const aiProviderPlugin = fp(async fastify => {
    // Create a modified config for the AI provider
    const aiConfig = {
      ...config,
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: await options.getApiKey('openai'),
      ANTHROPIC_API_KEY: await options.getApiKey('anthropic'),
      AI_MODEL: undefined,
      ...(options.systemPrompt ? { SYSTEM_PROMPT: options.systemPrompt } : {}),
    };

    // Temporarily override config for AI provider registration
    const originalConfig = fastify.config;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const typedConfig = aiConfig as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    fastify.config = typedConfig;

    await fastify.register(aiProviderService);

    // Restore original config
    if (originalConfig !== undefined) {
      fastify.config = originalConfig;
    }
  });

  await fastify.register(aiProviderPlugin);

  // Register support plugins
  await fastify.register(sensiblePlugin);
  await fastify.register(supportPlugin);

  // Register routes
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    forceESM: true,
  });
}

export const createAirboltCore = fp(airboltCore, {
  fastify: '5.x',
  name: '@airbolt/core',
});

// Re-export types and utilities
export {
  AIProviderError,
  AIProviderService,
  MessageSchema,
  ChatResponseSchema,
  ProviderConfigSchema,
  type Message,
  type ProviderConfig,
  PROVIDER_FEATURES,
} from './services/ai-provider.js';
export * from './services/chat-service.js';
export * from './services/provider-config.js';
