import type { FastifyInstance } from 'fastify';
import type { Message } from './ai-provider.js';
import { AIProviderError } from './ai-provider.js';

export interface ChatRequest {
  messages: Message[];
  system?: string | undefined;
  provider?: 'openai' | 'anthropic' | undefined;
  model?: string | undefined;
}

export interface ChatResponse {
  content: string;
  usage?:
    | {
        total_tokens?: number | undefined;
      }
    | undefined;
}

export interface StreamChunk {
  content: string;
}

export interface StreamCompletion {
  usage: {
    total_tokens: number;
  };
  duration: number;
}

export interface ChatServiceOptions {
  fastify: FastifyInstance;
  userId: string;
}

export class ChatService {
  constructor(private readonly options: ChatServiceOptions) {}

  /**
   * Process a non-streaming chat request
   */
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const { fastify } = this.options;
    const { messages, system, provider, model } = request;

    // Get response from AI provider
    const response = await fastify.aiProvider.createChatCompletion(
      messages,
      system,
      provider,
      model
    );

    // Track token usage
    const tokensUsed = response.usage?.total_tokens || 0;
    await this.consumeTokens(tokensUsed);

    return {
      content: response.content,
      usage: response.usage,
    };
  }

  /**
   * Process a streaming chat request
   */
  async *processStreamingChat(
    request: ChatRequest
  ): AsyncGenerator<StreamChunk | StreamCompletion, void, unknown> {
    const { fastify } = this.options;
    const { messages, system, provider, model } = request;
    const startTime = Date.now();

    // Get the stream result from AI provider
    const result = await fastify.aiProvider.createChatCompletionStream(
      messages,
      system,
      provider,
      model
    );

    let fullContent = '';

    // Stream the response chunks
    for await (const chunk of result.textStream) {
      fullContent += chunk;
      yield { content: chunk };
    }

    // Get actual token usage and track it
    const usage = await result.usage;
    const tokensUsed = usage.totalTokens;
    await this.consumeTokens(tokensUsed);

    // Return completion info
    const duration = Date.now() - startTime;
    yield {
      usage: { total_tokens: tokensUsed },
      duration,
    } as StreamCompletion;
  }

  /**
   * Get current usage info for the user
   */
  async getUserUsage(): Promise<
    import('../plugins/user-rate-limit.js').UsageInfo
  > {
    const { fastify, userId } = this.options;
    return fastify.getUserUsage(userId);
  }

  /**
   * Consume tokens and handle rate limiting
   */
  private async consumeTokens(tokensUsed: number): Promise<void> {
    const { fastify, userId } = this.options;
    await fastify.consumeUserTokens(userId, tokensUsed);
  }

  /**
   * Check if a request should be streamed based on accept header
   */
  static isStreamingRequest(acceptHeader: string | undefined): boolean {
    return !!acceptHeader && acceptHeader.includes('text/event-stream');
  }

  /**
   * Format error for API response
   */
  static formatError(error: unknown): {
    error: string;
    message: string;
    statusCode: number;
  } {
    if (error instanceof AIProviderError) {
      return {
        error: error.code || 'AIProviderError',
        message: error.message,
        statusCode: error.statusCode,
      };
    }

    return {
      error: 'InternalServerError',
      message: 'An unexpected error occurred while processing your request',
      statusCode: 500,
    };
  }
}
