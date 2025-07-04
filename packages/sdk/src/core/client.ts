import { z } from 'zod';
import { TokenManager, TokenError } from './token-manager.js';

/**
 * Message schema for validation
 */
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
});

/**
 * Chat request schema
 */
const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  system: z.string().optional(),
});

/**
 * Chat response schema
 */
const ChatResponseSchema = z.object({
  content: z.string(),
  usage: z.object({
    total_tokens: z.number(),
  }).optional(),
});

/**
 * Message interface
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Chat request interface
 */
export interface ChatRequest {
  messages: Message[];
  system?: string;
}

/**
 * Chat response interface
 */
export interface ChatResponse {
  content: string;
  usage?: {
    total_tokens: number;
  };
}

/**
 * Client configuration options
 */
export interface AirboltClientOptions {
  /** Base URL for the API */
  baseURL: string;
  /** User ID for token generation (optional) */
  userId?: string;
  /** Custom token manager (optional) */
  tokenManager?: TokenManager;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
}

/**
 * Custom error for API operations
 */
export class AirboltError extends Error {
  public override readonly name = 'AirboltError';
  
  public readonly statusCode?: number | undefined;
  public override readonly cause?: Error | undefined;
  
  constructor(
    message: string,
    statusCode?: number | undefined,
    cause?: Error | undefined
  ) {
    super(message);
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

/**
 * Core Airbolt client with token management and error handling
 * 
 * Features:
 * - Automatic JWT token management
 * - Request/response validation with Zod
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 * - Environment-agnostic (browser/Node.js)
 */
export class AirboltClient {
  private readonly tokenManager: TokenManager;
  private readonly options: Required<Omit<AirboltClientOptions, 'tokenManager'>>;

  constructor(options: AirboltClientOptions) {
    this.options = {
      baseURL: options.baseURL,
      userId: options.userId || 'dev-user',
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
    };

    // Use provided token manager or create a new one
    this.tokenManager = options.tokenManager || new TokenManager({
      baseURL: this.options.baseURL,
      userId: this.options.userId,
    });
  }

  /**
   * Send a chat request to the API
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Validate request
    const validatedRequest = ChatRequestSchema.parse(request);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        // Create a properly typed request for the internal method
        const typedRequest: ChatRequest = {
          messages: validatedRequest.messages,
        };
        if (validatedRequest.system !== undefined) {
          typedRequest.system = validatedRequest.system;
        }
        
        const response = await this.performChatRequest(typedRequest);
        const parsedResponse = ChatResponseSchema.parse(response);
        
        // Ensure the response conforms to exact optional property types
        const result: ChatResponse = {
          content: parsedResponse.content,
        };
        
        if (parsedResponse.usage !== undefined) {
          result.usage = parsedResponse.usage;
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on validation errors or client errors (4xx)
        if (error instanceof z.ZodError || 
            (error instanceof AirboltError && error.statusCode && error.statusCode < 500)) {
          throw error;
        }

        // For token errors, try to refresh the token and retry
        if (error instanceof TokenError && attempt < this.options.maxRetries) {
          this.tokenManager.clearToken();
          await this.sleep(this.options.retryDelay * Math.pow(2, attempt - 1));
          continue;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.options.maxRetries) {
          const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new AirboltError(
      `Chat request failed after ${this.options.maxRetries} attempts`,
      undefined,
      lastError ?? undefined
    );
  }

  /**
   * Perform the actual chat request
   */
  private async performChatRequest(request: ChatRequest): Promise<unknown> {
    const token = await this.tokenManager.getToken();
    const url = `${this.options.baseURL}/api/chat`;

    const fetchImpl = this.getFetchImplementation();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `Chat request failed: ${response.status}`;
        
        try {
          const errorData = await response.json() as { message?: string };
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Ignore JSON parsing errors
        }

        // Handle token-related errors
        if (response.status === 401) {
          throw new TokenError(errorMessage, response.status);
        }

        throw new AirboltError(errorMessage, response.status);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AirboltError('Request timed out', 408);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get the appropriate fetch implementation for the environment
   */
  private getFetchImplementation(): typeof fetch {
    // Universal environment (browser or Node.js)
    if (typeof globalThis !== 'undefined' && globalThis.fetch) {
      return globalThis.fetch.bind(globalThis);
    }

    // Fallback - this should not happen in modern environments
    throw new AirboltError(
      'No fetch implementation available. Please use a modern browser or Node.js 18+.'
    );
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the base URL
   */
  getBaseURL(): string {
    return this.options.baseURL;
  }

  /**
   * Get token manager info for debugging
   */
  getTokenInfo(): { hasToken: boolean; expiresAt?: Date; tokenType?: string } {
    return this.tokenManager.getTokenInfo();
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
}