import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { MessageSchema, ChatResponseSchema } from '../../services/openai.js';
import { OpenAIServiceError } from '../../services/openai.js';

// Request schema for chat endpoint
const ChatRequestSchema = z.object({
  messages: z
    .array(MessageSchema)
    .min(1, 'At least one message is required')
    .max(50, 'Too many messages in conversation'),
  system: z.string().optional(),
});

// JWT payload interface
interface JWTPayload {
  iat: number;
  exp: number;
  iss: string;
}

// Extend FastifyRequest with JWT payload
declare module 'fastify' {
  interface FastifyRequest {
    jwt?: JWTPayload;
  }
}

// JWT verification middleware
async function verifyJWT(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const auth = request.headers.authorization;

  if (!auth?.startsWith('Bearer ')) {
    throw request.server.httpErrors.unauthorized(
      'Missing or invalid authorization header'
    );
  }

  try {
    const token = auth.slice(7);
    const payload = request.server.jwt.verify(token);
    request.jwt = payload as JWTPayload;
  } catch (error) {
    request.log.warn({ error }, 'JWT verification failed');
    throw request.server.httpErrors.unauthorized('Invalid or expired token');
  }
}

const chat: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post(
    '/chat',
    {
      preHandler: [verifyJWT],
      schema: {
        tags: ['Chat'],
        summary: 'Send chat messages to AI',
        description:
          'Proxies chat messages to OpenAI and returns the assistant response',
        security: [{ BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['messages'],
          properties: {
            messages: {
              type: 'array',
              minItems: 1,
              maxItems: 50,
              items: {
                type: 'object',
                required: ['role', 'content'],
                properties: {
                  role: {
                    type: 'string',
                    enum: ['user', 'assistant', 'system'],
                    description: 'The role of the message sender',
                  },
                  content: {
                    type: 'string',
                    description: 'The content of the message',
                  },
                },
              },
              description: 'Array of conversation messages',
            },
            system: {
              type: 'string',
              description: 'Optional system prompt to override default',
            },
          },
        },
        response: {
          200: {
            description: 'Successful chat response',
            type: 'object',
            required: ['content'],
            properties: {
              content: {
                type: 'string',
                description: 'The AI assistant response',
              },
              usage: {
                type: 'object',
                properties: {
                  total_tokens: {
                    type: 'number',
                    description: 'Total tokens used in the request',
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - Invalid or missing JWT token',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          400: {
            description: 'Bad Request - Invalid input',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          429: {
            description: 'Rate Limit Exceeded',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          503: {
            description: 'Service Unavailable - OpenAI API issues',
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
      const startTime = Date.now();

      try {
        // Validate request body
        const { messages, system } = ChatRequestSchema.parse(request.body);

        // Log request (without sensitive content)
        request.log.info(
          {
            messageCount: messages.length,
            hasSystemPrompt: !!system,
            jwt: {
              iat: request.jwt?.iat,
              exp: request.jwt?.exp,
            },
          },
          'Processing chat request'
        );

        // Create OpenAI service instance with optional system prompt override
        let openaiService = fastify.openai;

        // If system prompt is provided in request, create a new service instance
        if (system) {
          const { OpenAIService } = await import('../../services/openai.js');
          const apiKey = fastify.config?.OPENAI_API_KEY;
          if (!apiKey) {
            throw new Error('OPENAI_API_KEY not configured');
          }
          openaiService = new OpenAIService(apiKey, system);
        }

        // Call OpenAI service
        const response = await openaiService.createChatCompletion(messages);

        // Log successful response
        const duration = Date.now() - startTime;
        request.log.info(
          {
            duration,
            usage: response.usage,
            responseLength: response.content.length,
          },
          'Chat request completed successfully'
        );

        // Validate response in development
        if (fastify.config?.NODE_ENV === 'development') {
          ChatResponseSchema.parse(response);
        }

        return reply.code(200).send(response);
      } catch (error) {
        const duration = Date.now() - startTime;

        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          const validationErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }));

          request.log.warn(
            { validationErrors, duration },
            'Chat request validation failed'
          );

          return reply.code(400).send({
            error: 'ValidationError',
            message: `Invalid request: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
            statusCode: 400,
          });
        }

        // Handle OpenAI service errors
        if (error instanceof OpenAIServiceError) {
          request.log.warn(
            {
              error: {
                message: error.message,
                statusCode: error.statusCode,
                code: error.code,
              },
              duration,
            },
            'OpenAI service error'
          );

          return reply.code(error.statusCode).send({
            error: error.code || 'OpenAIError',
            message: error.message,
            statusCode: error.statusCode,
          });
        }

        // Handle unexpected errors
        request.log.error(
          { error, duration },
          'Unexpected error in chat endpoint'
        );

        return reply.code(500).send({
          error: 'InternalServerError',
          message: 'An unexpected error occurred while processing your request',
          statusCode: 500,
        });
      }
    }
  );
};

export default chat;
