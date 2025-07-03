import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';

const tokenRoute: FastifyPluginAsync = async (fastify): Promise<void> => {
  // Create allowed origins Set from config
  const allowedOrigins = new Set(
    fastify.config?.ALLOWED_ORIGIN || ['http://localhost:3000']
  );

  fastify.post(
    '/token',
    {
      config: {
        rateLimit: {
          max: 3, // Linear spec: 3 requests/minute
          timeWindow: '1 minute',
        },
      },
      schema: {
        tags: ['Authentication'],
        summary: 'Generate authentication token',
        description:
          'Issues a JWT token for API authentication. Validates request origin against allowed origins.',
        headers: {
          type: 'object',
          required: ['origin'],
          properties: {
            origin: {
              type: 'string',
              description: 'Request origin for validation (required)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              tokenType: { type: 'string', enum: ['Bearer'] },
              expiresIn: { type: 'number' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          403: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
        },
      },
    },
    async request => {
      const { origin } = request.headers;

      // Validate origin header exists
      if (!origin) {
        throw fastify.httpErrors.badRequest('Origin header is required');
      }

      // Validate origin is allowed
      if (!allowedOrigins.has(origin)) {
        throw fastify.httpErrors.forbidden('Origin not allowed');
      }

      // Generate simple JWT with minimal claims
      const token = fastify.jwt.sign(
        {
          sub: randomUUID(), // Subject: unique session identifier
          aud: 'api', // Audience: this API
        },
        {
          expiresIn: '15m', // 15 minutes as per spec
        }
      );

      return {
        token,
        tokenType: 'Bearer' as const,
        expiresIn: 900, // 15 minutes in seconds
      };
    }
  );
};

export default tokenRoute;
