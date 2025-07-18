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
import { ColdStartError } from './errors.js';
import { isTimeoutError } from './timeout-utils.js';

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
  /**
   * Request timeout in seconds. Defaults to 60.
   */
  timeoutSeconds?: number;
  /**
   * Callback invoked when a cold start is detected.
   * This happens when the server takes longer than expected to respond,
   * typically because it's waking up from sleep.
   */
  onColdStartDetected?: () => void;
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
  private readonly options: AirboltClientOptions;
  private hasRetriedThisSession = false;

  constructor(options: AirboltClientOptions) {
    this.options = {
      ...options,
      timeoutSeconds: options.timeoutSeconds ?? 60,
    };

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
   * Send a chat request with automatic auth handling and cold start retry
   */
  async chat(
    messages: Message[],
    options?: {
      provider?: 'openai' | 'anthropic';
      model?: string;
    }
  ): Promise<ChatResponse> {
    const request: AirboltAPI.PostApiChatRequest = {
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      provider: options?.provider,
      model: options?.model,
    };

    try {
      // First attempt with configured timeout
      const response = await this.client.chat.sendChatMessagesToAi(request, {
        timeoutInSeconds: this.options.timeoutSeconds,
      });
      return this.mapChatResponse(response);
    } catch (error) {
      // Handle 401 by clearing token and retrying once
      if (error instanceof AirboltAPI.UnauthorizedError) {
        this.tokenManager.clearToken();
        const response = await this.client.chat.sendChatMessagesToAi(request, {
          timeoutInSeconds: this.options.timeoutSeconds,
        });
        return this.mapChatResponse(response);
      }

      // Handle timeout with cold start retry
      if (this.isTimeoutError(error) && !this.hasRetriedThisSession) {
        this.hasRetriedThisSession = true;

        // Notify about cold start detection
        this.options.onColdStartDetected?.();

        // Log for developer awareness
        console.info(
          '[Airbolt] Server appears to be starting up. Retrying with extended timeout...'
        );

        // Retry with double timeout
        try {
          const response = await this.client.chat.sendChatMessagesToAi(
            request,
            {
              timeoutInSeconds: (this.options.timeoutSeconds ?? 60) * 2,
            }
          );
          return this.mapChatResponse(response);
        } catch (retryError) {
          // If still timing out, throw a more helpful error
          if (this.isTimeoutError(retryError)) {
            throw new ColdStartError(
              'Server is taking longer than expected to respond. This may happen with free tier deployments that need to wake up from sleep.'
            );
          }
          throw retryError;
        }
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

  /**
   * Check if an error is a timeout error
   * @param error - The error to check (using unknown for safety)
   */
  private isTimeoutError(error: unknown): boolean {
    // Check for Fern-generated timeout error
    if (error && typeof error === 'object' && 'name' in error) {
      // The generated client throws AirboltAPITimeoutError
      if (error.constructor.name === 'AirboltAPITimeoutError') {
        return true;
      }
    }

    // Use utility function for other timeout patterns
    return isTimeoutError(error);
  }
}

// Re-export error types for convenience
export const UnauthorizedError = AirboltAPI.UnauthorizedError;
export const BadRequestError = AirboltAPI.BadRequestError;
export const TooManyRequestsError = AirboltAPI.TooManyRequestsError;
export const ServiceUnavailableError = AirboltAPI.ServiceUnavailableError;
export { AirboltAPIError } from '../../generated/index.js';
