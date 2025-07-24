import type { Message, TokenInfo, UsageInfo } from '@airbolt/sdk';

/**
 * Options for the useChat hook
 */
export interface UseChatOptions {
  /**
   * Base URL for the Airbolt API. Defaults to environment variable or production URL.
   */
  baseURL?: string;
  /**
   * System prompt to include with the messages
   */
  system?: string;
  /**
   * AI provider to use: 'openai' or 'anthropic'
   */
  provider?: 'openai' | 'anthropic';
  /**
   * Specific model to use (e.g., 'gpt-4', 'claude-3-5-sonnet-20241022')
   */
  model?: string;
  /**
   * Initial messages to populate the chat history
   */
  initialMessages?: Message[];
  /**
   * Enable streaming responses
   * @default true
   */
  streaming?: boolean;
  /**
   * Callback for streaming chunks
   */
  onChunk?: (chunk: string) => void;
}

/**
 * Return value of the useChat hook
 */
export interface UseChatReturn {
  /**
   * Array of all messages in the conversation
   */
  messages: Message[];
  /**
   * Current input value
   */
  input: string;
  /**
   * Function to update the input value
   */
  setInput: (value: string) => void;
  /**
   * Whether a message is currently being sent
   */
  isLoading: boolean;
  /**
   * Whether a response is currently streaming
   */
  isStreaming: boolean;
  /**
   * Error from the last send attempt, if any
   */
  error: Error | null;
  /**
   * Usage information from the last response
   */
  usage: UsageInfo | null;
  /**
   * Send the current input as a message
   */
  send: () => Promise<void>;
  /**
   * Clear all messages and reset the conversation
   */
  clear: () => void;
  /**
   * Clear the authentication token (useful for logout)
   */
  clearToken: () => void;
  /**
   * Check if there's a valid authentication token
   */
  hasValidToken: () => boolean;
  /**
   * Get token information for debugging
   */
  getTokenInfo: () => TokenInfo;
}

/**
 * Re-export types from SDK for convenience
 */
export type { Message, TokenInfo, UsageInfo } from '@airbolt/sdk';
