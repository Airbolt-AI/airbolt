import type {
  FastifyPluginAsync,
  FastifyServerOptions,
  FastifyInstance,
} from 'fastify';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import { isDevelopment } from '@airbolt/config';
import { createAirboltCore } from '@airbolt/core';

import envPlugin, { type Env } from './plugins/env.js';

export interface AppOptions
  extends FastifyServerOptions,
    Partial<{ skipEnvValidation?: boolean }> {
  skipEnvValidation?: boolean;
}

// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {};

/**
 * App factory function that creates a Fastify instance with configurable options
 * This allows us to create instances for different purposes (runtime, testing, OpenAPI generation)
 */
export async function buildApp(
  opts: AppOptions = {}
): Promise<FastifyInstance> {
  const isDev = opts.skipEnvValidation || isDevelopment();

  const fastify = Fastify({
    logger:
      opts.logger !== undefined
        ? opts.logger
        : isDev
          ? {
              level: 'info',
              transport: { target: 'pino-pretty' },
            }
          : {
              level: 'info',
            },
  });

  // Register swagger plugin for all environments (needed for tests and OpenAPI generation)
  const { default: swagger } = await import('@fastify/swagger');
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'AI Fastify Template API',
        description:
          'Production-ready Fastify backend API with TypeScript and comprehensive validation',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        {
          name: 'Root',
          description: 'Root endpoints',
        },
        {
          name: 'Authentication',
          description: 'Authentication endpoints',
        },
        {
          name: 'Chat',
          description: 'AI Chat endpoints',
        },
      ],
    },
    hideUntagged: false,
  });

  // Register swagger UI for development and test environments
  // In tests, logger is false and skipEnvValidation is not set
  const isTestEnv = opts.logger === false;
  if (isDev || isTestEnv) {
    const { default: swaggerUi } = await import('@fastify/swagger-ui');
    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
      staticCSP: true,
      transformSpecification: swaggerObject => swaggerObject,
      transformSpecificationClone: true,
    });
  }

  // Register the app plugin with options
  // Wrap with fp to break encapsulation and make decorators available at root level
  await fastify.register(fp(app), opts);

  return fastify;
}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Register env plugin first (unless skipped for OpenAPI generation)
  if (!opts.skipEnvValidation) {
    await fastify.register(envPlugin);
    
    // Register the core plugin with configuration from env
    await fastify.register(createAirboltCore, {
      jwtSecret: fastify.config!.JWT_SECRET,
      getApiKey: (provider: string) => {
        if (provider === 'openai') return fastify.config!.OPENAI_API_KEY || '';
        if (provider === 'anthropic') return fastify.config!.ANTHROPIC_API_KEY || '';
        throw new Error(`Unknown provider: ${provider}`);
      },
      allowedOrigins: fastify.config!.ALLOWED_ORIGIN,
      systemPrompt: fastify.config!.SYSTEM_PROMPT,
      rateLimitMax: fastify.config!.RATE_LIMIT_MAX,
      rateLimitTimeWindow: fastify.config!.RATE_LIMIT_TIME_WINDOW,
      trustProxy: fastify.config!.TRUST_PROXY,
      tokenLimitMax: fastify.config!.TOKEN_LIMIT_MAX,
      tokenLimitTimeWindow: fastify.config!.TOKEN_LIMIT_TIME_WINDOW,
      requestLimitMax: fastify.config!.REQUEST_LIMIT_MAX,
      requestLimitTimeWindow: fastify.config!.REQUEST_LIMIT_TIME_WINDOW,
      externalJwtIssuer: fastify.config!.EXTERNAL_JWT_ISSUER,
      externalJwtPublicKey: fastify.config!.EXTERNAL_JWT_PUBLIC_KEY,
      externalJwtSecret: fastify.config!.EXTERNAL_JWT_SECRET,
      externalJwtAudience: fastify.config!.EXTERNAL_JWT_AUDIENCE,
    });
  } else {
    // When skipping env validation (for OpenAPI generation), register a mock env plugin
    // to satisfy plugin dependencies
    await fastify.register(
      fp(
        fastify => {
          const mockConfig: Env = {
            NODE_ENV: 'development',
            PORT: 3000,
            LOG_LEVEL: 'info',
            OPENAI_API_KEY: 'sk-openapi-generation-placeholder',
            AI_PROVIDER: 'openai',
            ALLOWED_ORIGIN: ['*'], // Allow all origins for OpenAPI generation
            SYSTEM_PROMPT: '',
            RATE_LIMIT_MAX: 100,
            RATE_LIMIT_TIME_WINDOW: 60000,
            TRUST_PROXY: false,
            JWT_SECRET: 'openapi-generation-only-jwt-secret-placeholder',
            TOKEN_LIMIT_MAX: 100000,
            TOKEN_LIMIT_TIME_WINDOW: 3600000,
            REQUEST_LIMIT_MAX: 100,
            REQUEST_LIMIT_TIME_WINDOW: 3600000,
          };
          fastify.decorate('config', mockConfig);
        },
        { name: 'env-plugin' }
      )
    );
    
    // Register core with mock configuration
    await fastify.register(createAirboltCore, {
      jwtSecret: 'openapi-generation-only-jwt-secret-placeholder',
      getApiKey: () => 'sk-openapi-generation-placeholder',
      allowedOrigins: ['*'],
      systemPrompt: '',
      rateLimitMax: 100,
      rateLimitTimeWindow: 60000,
      trustProxy: false,
      tokenLimitMax: 100000,
      tokenLimitTimeWindow: 3600000,
      requestLimitMax: 100,
      requestLimitTimeWindow: 3600000,
    });
  }
};

export default app;
export { app, options };