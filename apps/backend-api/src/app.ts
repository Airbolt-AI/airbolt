import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import AutoLoad from '@fastify/autoload';
import type { AutoloadPluginOptions } from '@fastify/autoload';
import type {
  FastifyPluginAsync,
  FastifyServerOptions,
  FastifyInstance,
} from 'fastify';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import { isDevelopment } from '@airbolt/config';

import envPlugin, { type Env } from './plugins/env.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import fastifyJwt from '@fastify/jwt';
import aiProviderService from './services/ai-provider.js';
import fastifySse from 'fastify-sse-v2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import JWT types
import '@fastify/jwt';

export interface AppOptions
  extends FastifyServerOptions,
    Partial<AutoloadPluginOptions> {
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
          };
          fastify.decorate('config', mockConfig);
        },
        { name: 'env-plugin' }
      )
    );
  }

  // Register CORS plugin after env (it depends on ALLOWED_ORIGIN from env)
  await fastify.register(corsPlugin);

  // Register rate limit plugin after env (it depends on RATE_LIMIT_* from env)
  await fastify.register(rateLimitPlugin);

  // Register SSE plugin for streaming support
  await fastify.register(fastifySse);

  // Register JWT plugin after env (it depends on JWT_SECRET from env)
  // Use config which is decorated by the env plugin
  await fastify.register(fastifyJwt, {
    secret: fastify.config?.JWT_SECRET || 'development-secret',
    sign: {
      algorithm: 'HS256',
      expiresIn: '15m',
      iss: 'airbolt-api', // Issuer claim for token validation
    },
    verify: {
      allowedIss: 'airbolt-api', // Only accept tokens from our API
    },
  });

  // Register AI provider service after env (it depends on API keys from env)
  // Only register if env validation was not skipped (meaning we have real config)
  if (!opts.skipEnvValidation) {
    await fastify.register(aiProviderService);
  }

  // Swagger plugin registration moved to root level in buildApp function

  // Place here your custom code!

  // Do not touch the following lines

  // Register support plugins explicitly
  // No autoload = no stale cached files breaking builds
  await fastify.register(import('./plugins/sensible.js'));
  await fastify.register(import('./plugins/support.js'));

  // This loads all plugins defined in routes
  // define your routes in one of these
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts,
    forceESM: true,
  });
};

export default app;
export { app, options };
