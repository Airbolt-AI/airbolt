/**
 * Message format for chat interactions
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Options for the chat function
 */
export interface ChatOptions {
  /**
   * Base URL for the Airbolt API. Defaults to environment variable or production URL.
   */
  baseURL?: string;
  /**
   * System prompt to include with the messages
   */
  system?: string;
  /**
   * AI provider to use: 'openai' or 'anthropic'. Defaults to backend environment setting.
   */
  provider?: 'openai' | 'anthropic';
  /**
   * Specific model to use (e.g., 'gpt-4', 'claude-3-5-sonnet-20241022').
   * Defaults to the provider's default model.
   */
  model?: string;
  /**
   * Custom auth token getter function for BYOA (Bring Your Own Auth)
   * @example
   * getAuthToken: () => myAuth.getToken()
   */
  getAuthToken?: () => Promise<string> | string;
}

/**
 * Chat session interface for managing conversation state
 */
export interface ChatSession {
  /**
   * Send a message and receive a response
   * @param content The user's message content
   * @returns The assistant's response
   */
  send(content: string): Promise<string>;

  /**
   * Get all messages in the current session
   * @returns A read-only array of messages
   */
  getMessages(): readonly Message[];

  /**
   * Clear all messages from the session
   */
  clear(): void;
}

/**
 * Usage information returned by the API
 */
export interface UsageInfo {
  /** Total tokens consumed by this request */
  total_tokens: number;
  /** User's current rate limit usage (if rate limiting is enabled) */
  tokens?: {
    used: number;
    remaining: number;
    limit: number;
    resetAt: string;
  };
  requests?: {
    used: number;
    remaining: number;
    limit: number;
    resetAt: string;
  };
}

/**
 * Response from the chat API including usage information
 */
export interface ChatResponse {
  /** The AI assistant's response content */
  content: string;
  /** Usage information for this request */
  usage?: UsageInfo;
}

/**
 * Streaming response chunk
 */
export interface StreamChunk {
  /** Content chunk from the assistant */
  content: string;
  /** Type of chunk */
  type: 'chunk' | 'done' | 'error';
  /** Usage information (only present in 'done' chunks) */
  usage?: UsageInfo;
}
