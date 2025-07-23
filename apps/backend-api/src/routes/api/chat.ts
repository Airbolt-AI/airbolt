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
  userId: string;
  role: string;
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
    request.user = payload as JWTPayload;
  } catch (error) {
    request.log.warn({ error }, 'JWT verification failed');
    throw request.server.httpErrors.unauthorized('Invalid or expired token');
  }
}

const chat: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post(
    '/chat',
    {
      preHandler: [verifyJWT, fastify.checkUserRateLimit],
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
                  tokens: {
                    type: 'object',
                    properties: {
                      used: { type: 'number' },
                      remaining: { type: 'number' },
                      limit: { type: 'number' },
                      resetAt: { type: 'string', format: 'date-time' },
                    },
                  },
                  requests: {
                    type: 'object',
                    properties: {
                      used: { type: 'number' },
                      remaining: { type: 'number' },
                      limit: { type: 'number' },
                      resetAt: { type: 'string', format: 'date-time' },
                    },
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
              usage: {
                type: 'object',
                properties: {
                  tokens: {
                    type: 'object',
                    properties: {
                      used: { type: 'number' },
                      remaining: { type: 'number' },
                      limit: { type: 'number' },
                      resetAt: { type: 'string', format: 'date-time' },
                    },
                  },
                  requests: {
                    type: 'object',
                    properties: {
                      used: { type: 'number' },
                      remaining: { type: 'number' },
                      limit: { type: 'number' },
                      resetAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
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
          const userId = (request.user as { userId: string }).userId;

          // Reserve tokens for streaming (estimate)
          const estimatedTokens = 2000; // Conservative estimate
          try {
            await fastify.reserveTokens(userId, estimatedTokens);
          } catch (error) {
            // Token limit would be exceeded
            const usageInfo = await fastify.getUserUsage(userId);
            return reply.code(429).send({
              error: 'TokenLimitExceeded',
              message: 'Insufficient tokens for streaming request',
              statusCode: 429,
              usage: usageInfo,
            });
          }

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

            // Calculate actual tokens used (approximate)
            // In real implementation, we'd need to get this from the AI SDK
            const actualTokens = Math.min(tokenCount * 4, estimatedTokens); // Rough approximation

            // Refund unused tokens
            if (actualTokens < estimatedTokens) {
              await fastify.refundTokens(
                userId,
                estimatedTokens - actualTokens
              );
            }

            // Get updated usage info
            const usageInfo = await fastify.getUserUsage(userId);

            // Send completion event with usage data
            const duration = Date.now() - startTime;
            reply.sse({
              event: 'done',
              data: JSON.stringify({
                usage: {
                  total_tokens: actualTokens,
                  ...usageInfo,
                },
                duration,
              }),
            });

            request.log.info(
              {
                duration,
                responseLength: fullContent.length,
                tokenCount,
                actualTokens,
                streaming: true,
                userUsage: usageInfo,
              },
              'Streaming chat request completed successfully'
            );
          } catch (error) {
            // Refund reserved tokens on error
            await fastify.refundTokens(userId, estimatedTokens);

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

          // Track token usage
          const userId = (request.user as { userId: string }).userId;
          const tokensUsed = response.usage?.total_tokens || 0;

          try {
            await fastify.consumeTokens(userId, tokensUsed);
          } catch (error) {
            // Token limit exceeded - get usage info for response
            const usageInfo = await fastify.getUserUsage(userId);
            return reply.code(429).send({
              error: 'TokenLimitExceeded',
              message:
                error instanceof Error ? error.message : 'Token limit exceeded',
              statusCode: 429,
              usage: usageInfo,
            });
          }

          // Get updated usage info after consumption
          const usageInfo = await fastify.getUserUsage(userId);

          // Log successful response
          const duration = Date.now() - startTime;
          request.log.info(
            {
              duration,
              usage: response.usage,
              responseLength: response.content.length,
              userUsage: usageInfo,
            },
            'Chat request completed successfully'
          );

          // Validate response in development
          if (isDevelopment()) {
            ChatResponseSchema.parse(response);
          }

          // Add usage info to response
          const enhancedResponse = {
            ...response,
            usage: {
              ...response.usage,
              ...usageInfo,
            },
          };

          return reply.code(200).send(enhancedResponse);
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
