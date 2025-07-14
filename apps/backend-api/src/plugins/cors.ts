import fastifyCors, { type FastifyCorsOptions } from '@fastify/cors';
import fp from 'fastify-plugin';

export default fp(
  async fastify => {
    if (!fastify.config) {
      throw new Error(
        'Configuration plugin must be registered before CORS plugin'
      );
    }

    const corsOptions: FastifyCorsOptions = {
      // fastify-cors will do exact matching when given an array
      origin: (origin, callback) => {
        // Allow requests with no origin (same-origin, Postman, mobile apps)
        if (!origin) {
          callback(null, true);
          return;
        }

        // Check if wildcard or exact match against allowed origins
        const allowedOrigins = fastify.config?.ALLOWED_ORIGIN ?? [];
        const isAllowed =
          allowedOrigins.includes('*') || allowedOrigins.includes(origin);
        callback(
          isAllowed ? null : new Error('Not allowed by CORS'),
          isAllowed
        );
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-fern-runtime-version',
        'x-fern-language',
        'x-fern-runtime',
        'x-fern-sdk-name',
        'x-fern-sdk-version',
      ],
      exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
      maxAge: 86400, // 24 hours
    };

    await fastify.register(fastifyCors, corsOptions);

    fastify.log.info(
      {
        allowedOrigins: fastify.config.ALLOWED_ORIGIN,
        credentials: true,
      },
      'CORS configured'
    );
  },
  {
    name: 'cors-plugin',
    dependencies: ['env-plugin'],
  }
);
