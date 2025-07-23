import { chatSync } from './chat.js';
import type { Message, ChatSession, ChatOptions } from './types.js';

/**
 * Create a new chat session for managing conversation state
 *
 * @example
 * ```typescript
 * const session = createChatSession();
 *
 * const response1 = await session.send('What is 2+2?');
 * console.log(response1); // "2+2 equals 4"
 *
 * const response2 = await session.send('What did I just ask?');
 * console.log(response2); // "You asked what 2+2 equals"
 *
 * console.log(session.getMessages());
 * // [
 * //   { role: 'user', content: 'What is 2+2?' },
 * //   { role: 'assistant', content: '2+2 equals 4' },
 * //   { role: 'user', content: 'What did I just ask?' },
 * //   { role: 'assistant', content: 'You asked what 2+2 equals' }
 * // ]
 * ```
 *
 * @example
 * ```typescript
 * // With provider and model
 * const session = createChatSession({
 *   baseURL: 'https://api.airbolt.dev',
 *   provider: 'anthropic',
 *   model: 'claude-3-5-sonnet-20241022'
 * });
 * ```
 *
 * @param options Optional configuration for the chat session
 * @returns A new chat session instance
 */
export function createChatSession(options?: ChatOptions): ChatSession {
  // Initialize conversation history
  const messages: Message[] = [];

  return {
    async send(content: string): Promise<string> {
      // Add user message to history
      messages.push({ role: 'user', content });

      // Get response with full conversation history
      // Pass a copy to prevent mutation issues
      const reply = await chatSync([...messages], options);

      // Add assistant response to history
      messages.push({ role: 'assistant', content: reply });

      return reply;
    },

    getMessages(): readonly Message[] {
      // Return a read-only view of the messages
      return Object.freeze([...messages]);
    },

    clear(): void {
      // Clear all messages from the session
      messages.length = 0;
    },
  };
}
