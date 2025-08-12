import type { Message, ChatOptions, ChatResponse, UsageInfo } from './types.js';
import { AirboltError } from '../core/errors.js';
import { joinUrl } from '../core/url-utils.js';
import { getClientInstance } from './client-utils.js';

/**
 * Parse rate limit information from response headers
 */
function parseRateLimitHeaders(headers: Headers): Partial<UsageInfo> | null {
  const requestsLimit = headers.get('x-ratelimit-requests-limit');
  const requestsRemaining = headers.get('x-ratelimit-requests-remaining');
  const requestsReset = headers.get('x-ratelimit-requests-reset');

  const tokensLimit = headers.get('x-ratelimit-tokens-limit');
  const tokensRemaining = headers.get('x-ratelimit-tokens-remaining');
  const tokensReset = headers.get('x-ratelimit-tokens-reset');

  if (!requestsLimit && !tokensLimit) {
    return null;
  }

  const result: Partial<UsageInfo> = {};

  if (requestsLimit && requestsRemaining && requestsReset) {
    result.requests = {
      used: parseInt(requestsLimit) - parseInt(requestsRemaining),
      remaining: parseInt(requestsRemaining),
      limit: parseInt(requestsLimit),
      resetAt: new Date(parseInt(requestsReset) * 1000).toISOString(),
    };
  }

  if (tokensLimit && tokensRemaining && tokensReset) {
    result.tokens = {
      used: parseInt(tokensLimit) - parseInt(tokensRemaining),
      remaining: parseInt(tokensRemaining),
      limit: parseInt(tokensLimit),
      resetAt: new Date(parseInt(tokensReset) * 1000).toISOString(),
    };
  }

  return result;
}

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
 * console.log(response.content); // "I'm doing well, thank you!"
 * console.log(response.usage?.total_tokens); // 42
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
 * @returns The complete response including content and usage information
 */
export async function chat(
  messages: Message[],
  options?: ChatOptions
): Promise<ChatResponse> {
  // Get or create a client instance with auth support
  const client = getClientInstance(options?.baseURL, options);

  // Add system message if provided
  const allMessages = options?.system
    ? [{ role: 'system' as const, content: options.system }, ...messages]
    : messages;

  // Make the chat request with optional provider and model
  const response = await client.chat(allMessages, {
    provider: options?.provider,
    model: options?.model,
  });

  // Return the full response including usage information
  return response;
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
): AsyncGenerator<{
  content: string;
  type: 'chunk' | 'done' | 'error';
  usage?: UsageInfo;
}> {
  const baseURL = options?.baseURL || 'http://localhost:3000';

  try {
    // Use unified auth - same as non-streaming!
    const token = await getAuthToken(baseURL, options);

    // Create EventSource-like connection for SSE
    const response = await fetch(joinUrl(baseURL, 'api/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
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

    // Parse rate limit headers if present
    const rateLimitInfo = parseRateLimitHeaders(response.headers);

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
                // Parse usage data if present
                let usage: UsageInfo | undefined;
                if (parsedData.usage) {
                  const usageData = parsedData.usage as {
                    total_tokens?: number;
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
                  };
                  usage = {
                    total_tokens: usageData.total_tokens ?? 0,
                    // Include rate limit usage if present
                    ...(usageData.tokens && {
                      tokens: usageData.tokens,
                    }),
                    ...(usageData.requests && {
                      requests: usageData.requests,
                    }),
                  } as UsageInfo;
                }

                // Merge rate limit info from headers if available
                if (rateLimitInfo) {
                  usage = {
                    ...usage,
                    ...rateLimitInfo,
                    total_tokens: usage?.total_tokens ?? 0,
                  } as UsageInfo;
                }

                yield {
                  content: '',
                  type: 'done',
                  usage: usage ? usage : undefined,
                };
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

// Unified auth helper - ensures both streaming and non-streaming use same auth
async function getAuthToken(
  baseURL: string | undefined,
  options?: ChatOptions
): Promise<string> {
  // CRITICAL: This ensures auth provider detection happens for ALL chat paths
  const client = getClientInstance(baseURL, options);

  // The client has a private tokenManager, but we can access it via type assertion
  // This is safe because we control both the client and this code
  const tokenManager = (
    client as unknown as { tokenManager?: { getToken(): Promise<string> } }
  ).tokenManager;

  if (!tokenManager) {
    throw new AirboltError('Client does not have a token manager', 500);
  }

  return await tokenManager.getToken();
}

// Export aliases for renamed functions
export { chat as chatSync };
