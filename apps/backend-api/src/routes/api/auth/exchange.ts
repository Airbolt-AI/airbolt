import type { FastifyPluginAsync } from 'fastify';
import {
  detectProvider,
  validateProviderToken,
  AuthProviderError,
} from '../../../utils/auth-providers.js';

const exchange: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post(
    '/exchange',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Exchange provider token for session token',
        description:
          'Exchange a valid provider token for an internal session token',
        security: [{ BearerAuth: [] }],
        response: {
          200: {
            description: 'Token exchange successful',
            type: 'object',
            required: ['sessionToken', 'expiresAt', 'provider'],
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
        },
      },
    },
    async (request, reply) => {
      try {
        // Extract Bearer token from Authorization header
        const authHeader = request.headers.authorization;
        if (!authHeader) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Authorization header is required',
            statusCode: 401,
          });
        }

        const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
        if (!tokenMatch) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Authorization header must be in format "Bearer <token>"',
            statusCode: 401,
          });
        }

        const providerToken = tokenMatch[1];
        if (!providerToken?.trim()) {
          return reply.code(401).send({
            error: 'Unauthorized',
            message: 'Provider token cannot be empty',
            statusCode: 401,
          });
        }

        // Detect provider from JWT
        const detectedProvider = detectProvider(providerToken);
        if (detectedProvider === 'unknown') {
          return reply.code(400).send({
            error: 'BadRequest',
            message: 'Unable to detect authentication provider from token',
            statusCode: 400,
          });
        }

        // Basic validation - decode JWT and extract user info
        let validationResult: ReturnType<typeof validateProviderToken>;
        try {
          validationResult = validateProviderToken(
            providerToken,
            fastify.config
          );
        } catch (error: unknown) {
          if (error instanceof AuthProviderError) {
            return reply.code(401).send({
              error: 'Unauthorized',
              message: error.message,
              statusCode: 401,
            });
          }
          return reply.code(400).send({
            error: 'BadRequest',
            message: 'Invalid token format',
            statusCode: 400,
          });
        }

        // Exchange token via auth gateway
        const sessionToken = await fastify.authGateway.exchangeToken(
          providerToken,
          detectedProvider,
          validationResult.userId
        );

        // Log successful exchange
        request.log.info(
          {
            provider: detectedProvider,
            userId: validationResult.userId.substring(0, 8) + '...',
          },
          'Token exchange completed'
        );

        return reply.code(200).send({
          sessionToken: sessionToken.token,
          expiresAt: sessionToken.expiresAt.toISOString(),
          provider: sessionToken.provider,
        });
      } catch (error: unknown) {
        // Log and handle unexpected errors
        request.log.error({ error }, 'Token exchange failed');
        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'An unexpected error occurred',
          statusCode: 500,
        });
      }
    }
  );
};

export default exchange;
