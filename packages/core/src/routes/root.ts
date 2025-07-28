import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isDevelopment } from '@airbolt/config';

// Response schemas
const HelloWorldResponseSchema = z.object({
  message: z.string().describe('Welcome message'),
});

// Error response schemas for OpenAPI
const ErrorResponseSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'string',
      description: 'Error type',
      example: 'Bad Request',
    },
    message: {
      type: 'string',
      description: 'Error message',
      example: 'Invalid request parameters',
    },
    statusCode: {
      type: 'number',
      description: 'HTTP status code',
      example: 400,
    },
  },
  required: ['error', 'message', 'statusCode'],
} as const;

const root: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Root'],
        summary: 'Get welcome message',
        description: 'Returns a hello world message for API health check',
        response: {
          200: {
            description: 'Successful response',
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Welcome message',
                example: 'Hello World!',
              },
            },
            required: ['message'],
          },
          500: {
            description: 'Internal Server Error',
            ...ErrorResponseSchema,
          },
        },
      },
    },

    async (_request, _reply) => {
      const response = { message: 'Hello World!' };

      // Validate response against schema in development
      if (isDevelopment()) {
        HelloWorldResponseSchema.parse(response);
      }

      return response;
    }
  );
};

export default root;
