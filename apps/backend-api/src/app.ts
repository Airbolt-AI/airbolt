import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import AutoLoad from '@fastify/autoload';
import type { AutoloadPluginOptions } from '@fastify/autoload';
import type { FastifyPluginAsync, FastifyServerOptions } from 'fastify';

import envPlugin from './plugins/env.js';
import jwtPlugin from './plugins/jwt.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import openaiService from './services/openai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AppOptions
  extends FastifyServerOptions,
    Partial<AutoloadPluginOptions> {}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {};

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // Register env plugin first
  await fastify.register(envPlugin);

  // Register JWT plugin after env (it depends on JWT_SECRET from env)
  await fastify.register(jwtPlugin);

  // Register rate limit plugin after env (it depends on RATE_LIMIT_* from env)
  await fastify.register(rateLimitPlugin);

  // Register OpenAI service after env (it depends on OPENAI_API_KEY from env)
  await fastify.register(openaiService);

  // Place here your custom code!

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    ignorePattern: /.*(env|jwt|rate-limit)\.(ts|js)$/,
    options: opts,
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts,
  });
};

export default app;
export { app, options };
