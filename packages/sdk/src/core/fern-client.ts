/**
 * Minimal auth wrapper around Fern-generated client
 *
 * This wrapper provides automatic JWT token management while leveraging
 * Fern's generated client for all API operations. It maintains the same
 * clean API surface as the previous hand-written client but with
 * significantly less code to maintain.
 */

import { AirboltAPIClient, AirboltAPI } from '../../generated/index.js';
import { TokenManager } from './token-manager.js';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  content: string;
  usage?: {
    total_tokens: number;
  };
}

export interface AirboltClientOptions {
  baseURL: string;
  userId?: string;
  tokenManager?: TokenManager;
}

/**
 * Airbolt client with automatic JWT token management
 *
 * Features:
 * - Automatic token refresh via TokenManager
 * - Clean API surface matching previous client
 * - Full type safety from Fern generation
 * - Automatic retry on 401 errors
 */
export class AirboltClient {
  private readonly client: AirboltAPIClient;
  private readonly tokenManager: TokenManager;

  constructor(options: AirboltClientOptions) {
    // Use provided token manager or create new one
    this.tokenManager =
      options.tokenManager ||
      new TokenManager({
        baseURL: options.baseURL,
        userId: options.userId,
      });

    // Initialize Fern client with async token supplier
    this.client = new AirboltAPIClient({
      baseUrl: options.baseURL,
      token: async () => this.tokenManager.getToken(),
    });
  }

  /**
   * Send a chat request with automatic auth handling
   */
  async chat(messages: Message[]): Promise<ChatResponse> {
    const request: AirboltAPI.PostApiChatRequest = {
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    try {
      const response = await this.client.chat.sendChatMessagesToAi(request);
      return this.mapChatResponse(response);
    } catch (error) {
      // Handle 401 by clearing token and retrying once
      if (error instanceof AirboltAPI.UnauthorizedError) {
        this.tokenManager.clearToken();
        const response = await this.client.chat.sendChatMessagesToAi(request);
        return this.mapChatResponse(response);
      }

      // Re-throw other errors as-is
      throw error;
    }
  }

  /**
   * Clear stored token (useful for logout)
   */
  clearToken(): void {
    this.tokenManager.clearToken();
  }

  /**
   * Check if client has a valid token
   */
  hasValidToken(): boolean {
    return this.tokenManager.hasValidToken();
  }

  /**
   * Get token info for debugging
   */
  getTokenInfo(): { hasToken: boolean; expiresAt?: Date; tokenType?: string } {
    return this.tokenManager.getTokenInfo();
  }

  /**
   * Get the base URL
   */
  getBaseURL(): string {
    return this.client['_options'].baseUrl as string;
  }

  /**
   * Map Fern response to our ChatResponse interface
   */
  private mapChatResponse(
    response: AirboltAPI.PostApiChatResponse
  ): ChatResponse {
    return {
      content: response.content,
      usage: response.usage
        ? {
            total_tokens: response.usage.total_tokens ?? 0,
          }
        : undefined,
    };
  }
}

// Re-export error types for convenience
export const UnauthorizedError = AirboltAPI.UnauthorizedError;
export const BadRequestError = AirboltAPI.BadRequestError;
export const TooManyRequestsError = AirboltAPI.TooManyRequestsError;
export const ServiceUnavailableError = AirboltAPI.ServiceUnavailableError;
export { AirboltAPIError } from '../../generated/index.js';
