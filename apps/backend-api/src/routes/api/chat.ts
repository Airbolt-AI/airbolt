import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isDevelopment } from '@airbolt/config';
import {
  MessageSchema,
  ChatResponseSchema,
} from '../../services/ai-provider.js';
import type { UsageInfo } from '../../plugins/user-rate-limit.js';
import { AuthValidatorFactory, createAuthMiddleware } from '@airbolt/auth';
import { ChatService } from '../../services/chat-service.js';

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

const chat: FastifyPluginAsync = async (fastify): Promise<void> => {
  // Create auth validators using factory pattern
  const validators = AuthValidatorFactory.create(fastify.config || {}, fastify);
  const verifyJWT = createAuthMiddleware(fastify, validators);

  // Add onSend hook to ensure X-BYOA-Mode header is always set
  fastify.addHook('onSend', async (_request, reply) => {
    const config = (fastify.config as { EXTERNAL_JWT_ISSUER?: string }) || {};
    const byoaMode = config.EXTERNAL_JWT_ISSUER ? 'strict' : 'auto';
    void reply.header('X-BYOA-Mode', byoaMode);
  });

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
        const chatRequest = ChatRequestSchema.parse(request.body);
        const userId = (request.user as JWTPayload).userId;

        // Create service instance
        const chatService = new ChatService({ fastify, userId });

        // Check if streaming is requested
        const isStreaming = ChatService.isStreamingRequest(
          request.headers.accept
        );

        // Log request (without sensitive content)
        request.log.info(
          {
            messageCount: chatRequest.messages.length,
            hasSystemPrompt: !!chatRequest.system,
            provider: chatRequest.provider,
            model: chatRequest.model,
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
            // Process streaming chat
            for await (const chunk of chatService.processStreamingChat(
              chatRequest
            )) {
              if ('content' in chunk) {
                // Stream chunk
                reply.sse({
                  event: 'chunk',
                  data: JSON.stringify({ content: chunk.content }),
                });
              } else {
                // Completion info
                const usageInfo = await chatService.getUserUsage();
                reply.sse({
                  event: 'done',
                  data: JSON.stringify({
                    usage: {
                      total_tokens: chunk.usage.total_tokens,
                      ...usageInfo,
                    },
                    duration: chunk.duration,
                  }),
                });

                request.log.info(
                  {
                    duration: chunk.duration,
                    tokensUsed: chunk.usage.total_tokens,
                    streaming: true,
                    userUsage: usageInfo,
                  },
                  'Streaming chat request completed successfully'
                );
              }
            }
          } catch (error) {
            // Handle streaming errors
            const errorResponse = ChatService.formatError(error);

            // Include usage info if it's a rate limit error
            interface ErrorData {
              error: string;
              message: string;
              usage?: UsageInfo;
            }
            const errorData: ErrorData = {
              error: errorResponse.error,
              message: errorResponse.message,
            };
            const errorWithUsage = error as {
              statusCode?: number;
              usage?: UsageInfo;
            };
            if (errorWithUsage.statusCode === 429 && errorWithUsage.usage) {
              errorData.usage = errorWithUsage.usage;
            }

            // Send error event
            reply.sse({
              event: 'error',
              data: JSON.stringify(errorData),
            });

            request.log.error(
              { error, streaming: true },
              'Error during streaming response'
            );
            return;
          }
        } else {
          // Non-streaming response
          try {
            const response = await chatService.processChat(chatRequest);
            const usageInfo = await chatService.getUserUsage();

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
          } catch (error) {
            // Handle token limit errors
            if (
              error instanceof Error &&
              error.message.includes('Token limit exceeded')
            ) {
              const usageInfo = await chatService.getUserUsage();
              return reply.code(429).send({
                error: 'TokenLimitExceeded',
                message: error.message,
                statusCode: 429,
                usage: usageInfo,
              });
            }
            throw error;
          }
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

        // Handle all other errors
        const errorResponse = ChatService.formatError(error);
        request.log.error(
          { error, duration },
          errorResponse.statusCode === 500
            ? 'Unexpected error in chat endpoint'
            : 'AI provider service error'
        );

        return reply.code(errorResponse.statusCode).send(errorResponse);
      }
    }
  );
};

export default chat;
