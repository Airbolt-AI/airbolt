import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { isDevelopment } from '@airbolt/config';
import {
  MessageSchema,
  ChatResponseSchema,
  AIProviderError,
} from '../../services/ai-provider.js';

// Request schema for chat endpoint
const ChatRequestSchema = z.object({
  messages: z
    .array(MessageSchema)
    .min(1, 'At least one message is required')
    .max(50, 'Too many messages in conversation'),
  system: z.string().optional(),
  provider: z.enum(['openai', 'anthropic']).optional(),
  model: z.string().optional(),
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
          'Proxies chat messages to configured AI provider and returns the assistant response',
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
            provider: {
              type: 'string',
              enum: ['openai', 'anthropic'],
              description:
                'AI provider to use (defaults to environment setting)',
            },
            model: {
              type: 'string',
              description:
                'Specific model to use (defaults to provider default)',
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
            description: 'Service Unavailable - AI provider API issues',
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
        const { messages, system, provider, model } = ChatRequestSchema.parse(
          request.body
        );

        // Check if streaming is requested
        const acceptHeader = request.headers.accept || '';
        const isStreaming = acceptHeader.includes('text/event-stream');

        // Log request (without sensitive content)
        request.log.info(
          {
            messageCount: messages.length,
            hasSystemPrompt: !!system,
            provider: provider,
            model: model,
            streaming: isStreaming,
            jwt: {
              iat: request.jwt?.iat,
              exp: request.jwt?.exp,
            },
          },
          'Processing chat request'
        );

        if (isStreaming) {
          // Streaming response
          reply.sse({
            event: 'start',
            data: JSON.stringify({ type: 'start' }),
          });

          try {
            // Get the stream from AI provider
            const stream = await fastify.aiProvider.createChatCompletionStream(
              messages,
              system,
              provider,
              model
            );

            let fullContent = '';
            let tokenCount = 0;

            // Stream the response
            for await (const chunk of stream) {
              fullContent += chunk;
              tokenCount++;

              // Send SSE event with the chunk
              reply.sse({
                event: 'chunk',
                data: JSON.stringify({ content: chunk }),
              });
            }

            // Send completion event with usage data
            const duration = Date.now() - startTime;
            reply.sse({
              event: 'done',
              data: JSON.stringify({
                usage: {
                  total_tokens: tokenCount,
                },
                duration,
              }),
            });

            request.log.info(
              {
                duration,
                responseLength: fullContent.length,
                tokenCount,
                streaming: true,
              },
              'Streaming chat request completed successfully'
            );
          } catch (error) {
            // Send error event before closing
            reply.sse({
              event: 'error',
              data: JSON.stringify({
                error:
                  error instanceof AIProviderError
                    ? error.code
                    : 'STREAM_ERROR',
                message:
                  error instanceof Error ? error.message : 'Stream failed',
              }),
            });

            // Log the error but don't throw - SSE response already started
            request.log.error(
              {
                error,
                streaming: true,
              },
              'Error during streaming response'
            );

            // Return to end the SSE stream gracefully
            return;
          }
        } else {
          // Non-streaming response (existing logic)
          const response = await fastify.aiProvider.createChatCompletion(
            messages,
            system,
            provider,
            model
          );

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
          if (isDevelopment()) {
            ChatResponseSchema.parse(response);
          }

          return reply.code(200).send(response);
        }
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

        // Handle AI provider errors
        if (error instanceof AIProviderError) {
          request.log.warn(
            {
              error: {
                message: error.message,
                statusCode: error.statusCode,
                code: error.code,
              },
              duration,
            },
            'AI provider service error'
          );

          return reply.code(error.statusCode).send({
            error: error.code || 'AIProviderError',
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
