import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// Simple token request schema for development
const TokenRequestSchema = z.object({
  // For development, we'll make this optional
  // In production, this would require user credentials
  userId: z.string().optional().default('dev-user'),
});

const TokenResponseSchema = z.object({
  token: z.string(),
  expiresIn: z.string(),
  tokenType: z.string(),
});

const tokens: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post(
    '/tokens',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Generate JWT token',
        description:
          'Generate a JWT token for API authentication (development endpoint)',
        body: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User identifier (optional for development)',
              default: 'dev-user',
            },
          },
        },
        response: {
          201: {
            description: 'Token generated successfully',
            type: 'object',
            required: ['token', 'expiresIn', 'tokenType'],
            properties: {
              token: {
                type: 'string',
                description: 'JWT token',
              },
              expiresIn: {
                type: 'string',
                description: 'Token expiration time',
              },
              tokenType: {
                type: 'string',
                description: 'Token type',
              },
            },
          },
          400: {
            description: 'Bad Request',
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
        // Parse and validate request body (if any)
        const { userId } = TokenRequestSchema.parse(request.body || {});

        // Generate JWT token with development payload
        const token = fastify.jwt.sign(
          {
            userId,
            role: 'user',
          },
          {
            expiresIn: '15m',
            iss: 'airbolt-api',
          }
        );

        const response = {
          token,
          expiresIn: '15m',
          tokenType: 'Bearer',
        };

        // Validate response in development
        if (fastify.config?.NODE_ENV === 'development') {
          TokenResponseSchema.parse(response);
        }

        request.log.info(
          { userId },
          'Development JWT token generated successfully'
        );

        return reply.code(201).send(response);
      } catch (error) {
        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          const validationErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }));

          request.log.warn(
            { validationErrors },
            'Token generation validation failed'
          );

          return reply.code(400).send({
            error: 'ValidationError',
            message: `Invalid request: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
            statusCode: 400,
          });
        }

        // Handle unexpected errors
        request.log.error(error, 'Unexpected error in token generation');

        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'An unexpected error occurred while generating token',
          statusCode: 500,
        });
      }
    }
  );
};

export default tokens;
