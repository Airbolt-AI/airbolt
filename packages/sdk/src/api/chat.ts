import { AirboltClient } from '../core/fern-client.js';
import type { Message, ChatOptions } from './types.js';
import { AirboltError } from '../core/errors.js';
import { joinUrl } from '../core/url-utils.js';

/**
 * Send a chat message to Airbolt and receive a complete response (non-streaming)
 *
 * Note: For the default streaming behavior, use `chat()` instead.
 *
 * @example
 * ```typescript
 * const response = await chatSync([
 *   { role: 'user', content: 'Hello, how are you?' }
 * ]);
 * console.log(response); // "I'm doing well, thank you!"
 * ```
 *
 * @example
 * ```typescript
 * // With options
 * const response = await chatSync(
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
 * @returns The complete assistant's response content
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

/**
 * Stream a chat response from Airbolt (default behavior)
 *
 * This is the default `chat()` function - streaming provides better UX with
 * real-time responses. For non-streaming behavior, use `chatSync()`.
 *
 * @example
 * ```typescript
 * for await (const chunk of chat([
 *   { role: 'user', content: 'Tell me a story' }
 * ])) {
 *   process.stdout.write(chunk.content);
 * }
 * ```
 *
 * @param messages Array of messages in the conversation
 * @param options Optional configuration
 * @returns Async generator yielding content chunks
 */
export async function* chatStream(
  messages: Message[],
  options?: ChatOptions
): AsyncGenerator<{ content: string; type: 'chunk' | 'done' | 'error' }> {
  const baseURL = options?.baseURL || 'http://localhost:3000';

  try {
    // Create EventSource-like connection for SSE
    const response = await fetch(joinUrl(baseURL, 'api/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${await getOrCreateToken(baseURL)}`,
      },
      body: JSON.stringify({
        messages,
        system: options?.system,
        provider: options?.provider,
        model: options?.model,
      }),
    });

    if (!response.ok) {
      throw new AirboltError(
        `HTTP error! status: ${response.status}`,
        response.status,
        await response.text()
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new AirboltError('Response body is not readable', 500);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages (ended with double newline)
      const messages = buffer.split('\n\n');
      buffer = messages.pop() || ''; // Keep incomplete message in buffer

      for (const message of messages) {
        if (!message.trim()) continue;

        const lines = message.split('\n');
        let event = '';
        let data = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            data = line.slice(6);
          }
        }

        if (event && data) {
          try {
            const parsedData = JSON.parse(data) as {
              content?: string;
              message?: string;
              error?: string;
              type?: string;
              usage?: { total_tokens: number };
            };

            switch (event) {
              case 'start':
                // Ignore start event
                break;
              case 'chunk':
                if (parsedData.content !== undefined) {
                  yield { content: parsedData.content, type: 'chunk' };
                }
                break;
              case 'done':
                yield { content: '', type: 'done' };
                return;
              case 'error':
                throw new AirboltError(
                  parsedData.message || 'Stream error',
                  500,
                  parsedData.error
                );
            }
          } catch (e) {
            // Re-throw AirboltError instances
            if (e instanceof AirboltError) {
              throw e;
            }
            // Ignore parse errors for now
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof AirboltError) {
      throw error;
    }
    throw new AirboltError(
      error instanceof Error ? error.message : 'Stream failed',
      500
    );
  }
}

// Helper function to get or create token
async function getOrCreateToken(baseURL: string): Promise<string> {
  const response = await fetch(joinUrl(baseURL, 'api/tokens'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: 'streaming-user' }),
  });

  if (!response.ok) {
    throw new AirboltError(
      `Failed to get token: ${response.status}`,
      response.status
    );
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

// Export aliases for renamed functions
export { chat as chatSync };
