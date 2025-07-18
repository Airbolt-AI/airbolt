import { AirboltClient } from '../core/fern-client.js';
import type { Message, ChatOptions } from './types.js';

/**
 * Send a chat message to Airbolt and receive a response
 *
 * @example
 * ```typescript
 * const response = await chat([
 *   { role: 'user', content: 'Hello, how are you?' }
 * ]);
 * console.log(response); // "I'm doing well, thank you!"
 * ```
 *
 * @example
 * ```typescript
 * // With options
 * const response = await chat(
 *   [{ role: 'user', content: 'Tell me a joke' }],
 *   {
 *     baseURL: 'https://api.airbolt.dev',
 *     system: 'You are a helpful assistant who tells funny jokes'
 *   }
 * );
 * ```
 *
 * @param messages Array of messages in the conversation
 * @param options Optional configuration
 * @returns The assistant's response content
 */
export async function chat(
  messages: Message[],
  options?: ChatOptions
): Promise<string> {
  // Create a new client instance for this request
  // Use provided baseURL or default to localhost
  const baseURL = options?.baseURL || 'http://localhost:3000';

  const client = new AirboltClient({ baseURL });

  // Add system message if provided
  const allMessages = options?.system
    ? [{ role: 'system' as const, content: options.system }, ...messages]
    : messages;

  // Make the chat request with optional provider and model
  const response = await client.chat(allMessages, {
    provider: options?.provider,
    model: options?.model,
  });

  // Return only the assistant's content for simplicity
  return response.content;
}
