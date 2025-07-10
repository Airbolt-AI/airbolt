import fp from 'fastify-plugin';
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsNonStreaming,
} from 'openai/resources/chat/completions';
import { z } from 'zod';

// Message schemas matching OpenAI's types
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;

// Response schema
export const ChatResponseSchema = z.object({
  content: z.string(),
  usage: z
    .object({
      total_tokens: z.number(),
    })
    .optional(),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// Error types for better error handling
export class OpenAIServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = 'OpenAIServiceError';
  }
}

export class OpenAIService {
  private client: OpenAI;
  private systemPrompt?: string;
  private model: string = 'gpt-4o-mini';
  private maxRetries: number = 3;
  private baseDelay: number = 1000; // 1 second

  constructor(
    apiKey: string,
    systemPrompt?: string,
    options?: {
      model?: string;
      maxRetries?: number;
      baseDelay?: number;
    }
  ) {
    this.client = new OpenAI({ apiKey });
    if (systemPrompt !== undefined) {
      this.systemPrompt = systemPrompt;
    }

    if (options?.model) {
      this.model = options.model;
    }
    if (options?.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries;
    }
    if (options?.baseDelay !== undefined) {
      this.baseDelay = options.baseDelay;
    }
  }

  async createChatCompletion(messages: Message[]): Promise<ChatResponse> {
    const messagesWithSystem = this.injectSystemPrompt(messages);

    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const params: ChatCompletionCreateParamsNonStreaming = {
          model: this.model,
          messages: messagesWithSystem as ChatCompletionMessageParam[],
          temperature: 0.7,
          max_tokens: 1000,
        };

        const completion = await this.client.chat.completions.create(params);

        const content = completion.choices[0]?.message?.content;

        if (!content) {
          throw new Error('No content in OpenAI response');
        }

        return {
          content,
          usage: completion.usage
            ? {
                total_tokens: completion.usage.total_tokens,
              }
            : undefined,
        };
      } catch (error) {
        lastError = error;

        // Don't retry for client errors (4xx)
        if (
          error instanceof OpenAI.APIError &&
          error.status &&
          error.status < 500 &&
          error.status !== 429
        ) {
          this.handleOpenAIError(error);
        }

        // For server errors and rate limits, retry with exponential backoff
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }
      }
    }

    // If we've exhausted retries, handle the last error
    this.handleOpenAIError(lastError);
  }

  private injectSystemPrompt(messages: Message[]): Message[] {
    if (!this.systemPrompt || this.systemPrompt.trim() === '') {
      return messages;
    }

    // Check if first message is already a system message
    if (messages.length > 0 && messages[0]?.role === 'system') {
      // Replace it with our system prompt
      return [
        { role: 'system', content: this.systemPrompt },
        ...messages.slice(1),
      ];
    }

    // Otherwise, prepend the system prompt
    return [{ role: 'system', content: this.systemPrompt }, ...messages];
  }

  private handleOpenAIError(error: unknown): never {
    // Check if it's our mock APIError
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      'name' in error
    ) {
      const apiError = error as {
        status: number;
        message: string;
        name: string;
      };

      // Handle API errors
      switch (apiError.status) {
        case 401:
          throw new OpenAIServiceError(
            'Invalid OpenAI API key',
            401,
            'INVALID_API_KEY'
          );
        case 429:
          // Check if it's a quota issue vs rate limit
          if (
            apiError.message?.includes('quota') ||
            apiError.message?.includes('billing')
          ) {
            throw new OpenAIServiceError(
              'OpenAI quota exceeded. Please check your OpenAI account billing.',
              402,
              'INSUFFICIENT_QUOTA'
            );
          }
          throw new OpenAIServiceError(
            'Rate limit exceeded. Please try again later.',
            429,
            'RATE_LIMIT_EXCEEDED'
          );
        case 400:
          throw new OpenAIServiceError(
            'Invalid request to OpenAI API',
            400,
            'INVALID_REQUEST'
          );
        case 500:
        case 502:
        case 503:
          throw new OpenAIServiceError(
            'OpenAI service temporarily unavailable',
            503,
            'SERVICE_UNAVAILABLE'
          );
        default:
          if (apiError.status) {
            throw new OpenAIServiceError(
              `OpenAI API error: ${apiError.message || 'Unknown error'}`,
              apiError.status,
              'OPENAI_ERROR'
            );
          }
      }
    }

    if (error instanceof Error) {
      // Network errors or other unexpected errors
      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT')
      ) {
        throw new OpenAIServiceError(
          'Unable to connect to OpenAI API',
          503,
          'CONNECTION_ERROR'
        );
      }

      // Special case for "No content" error
      if (error.message === 'No content in OpenAI response') {
        throw new OpenAIServiceError(
          'No content in OpenAI response',
          500,
          'NO_CONTENT'
        );
      }

      throw new OpenAIServiceError(
        'Unexpected error communicating with OpenAI',
        500,
        'UNEXPECTED_ERROR'
      );
    }

    throw new OpenAIServiceError(
      'Unknown error occurred',
      500,
      'UNKNOWN_ERROR'
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }
}

// Fastify plugin to register the service
declare module 'fastify' {
  interface FastifyInstance {
    openai: OpenAIService;
  }
}

export default fp(
  fastify => {
    const apiKey = fastify.config?.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const systemPrompt = fastify.config?.SYSTEM_PROMPT;

    const service = new OpenAIService(apiKey, systemPrompt, {
      model: 'gpt-4o-mini', // Using the more cost-effective model
      maxRetries: 3,
      baseDelay: 1000,
    });

    fastify.decorate('openai', service);

    fastify.log.info('OpenAI service registered successfully');
  },
  {
    name: 'openai-service',
    dependencies: ['env-plugin'],
  }
);
