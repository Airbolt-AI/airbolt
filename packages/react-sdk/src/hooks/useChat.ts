import { useState, useCallback, useRef, useEffect } from 'react';
import {
  chat,
  chatSync,
  clearAuthToken,
  hasValidToken,
  getTokenInfo,
  type ChatOptions,
  type UsageInfo,
} from '@airbolt/sdk';
import type { UseChatOptions, UseChatReturn, Message } from '../types/index.js';

/**
 * React hook for managing chat conversations with Airbolt
 *
 * Streaming is enabled by default for better UX. To disable streaming,
 * explicitly set `streaming: false` in options.
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const {
 *     messages,
 *     input,
 *     setInput,
 *     send,
 *     isLoading,
 *     usage,
 *     clearToken,
 *     hasValidToken,
 *     getTokenInfo
 *   } = useChat({
 *     system: 'You are a helpful assistant'
 *     // streaming: true is the default
 *   });
 *
 *   return (
 *     <div>
 *       <div>Auth Status: {hasValidToken() ? 'Authenticated' : 'Not authenticated'}</div>
 *       {usage && (
 *         <div>
 *           Tokens: {usage.tokens?.used ?? 0}/{usage.tokens?.limit ?? 'N/A'}
 *           (resets {usage.tokens?.resetAt ? new Date(usage.tokens.resetAt).toLocaleTimeString() : 'N/A'})
 *         </div>
 *       )}
 *       {messages.map((m, i) => (
 *         <div key={i}>
 *           <b>{m.role}:</b> {m.content}
 *         </div>
 *       ))}
 *       <input
 *         value={input}
 *         onChange={e => setInput(e.target.value)}
 *         onKeyPress={e => e.key === 'Enter' && send()}
 *       />
 *       <button onClick={send} disabled={isLoading}>
 *         Send
 *       </button>
 *       <button onClick={clearToken}>
 *         Logout
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @param options Configuration options for the chat
 * @returns Chat state and control functions
 */
export function useChat(options?: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>(
    options?.initialMessages || []
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  // Use ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(false);

  // Track abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Set mounted to true when effect runs
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests on unmount
      abortControllerRef.current?.abort();
    };
  }, []);

  const send = useCallback(async () => {
    if (!input.trim() || isLoading || isStreaming) {
      return;
    }

    // Cancel any previous pending request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    };

    // Optimistically add user message
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Prepare chat options
      const allMessages = [...messages, userMessage];
      const chatOptions: ChatOptions = {};
      if (options?.baseURL !== undefined) {
        chatOptions.baseURL = options.baseURL;
      }
      if (options?.system !== undefined) {
        chatOptions.system = options.system;
      }
      if (options?.provider !== undefined) {
        chatOptions.provider = options.provider;
      }
      if (options?.model !== undefined) {
        chatOptions.model = options.model;
      }

      if (options?.streaming !== false) {
        // Streaming mode (default)
        setIsStreaming(true);
        setIsLoading(false);

        // Add an empty assistant message that we'll update
        const assistantMessage: Message = {
          role: 'assistant',
          content: '',
        };

        if (isMountedRef.current) {
          setMessages(prev => [...prev, assistantMessage]);
        }

        let fullContent = '';

        for await (const chunk of chat(allMessages, chatOptions)) {
          if (!isMountedRef.current) break;

          if (chunk.type === 'chunk') {
            fullContent += chunk.content;

            // Update the last message with accumulated content
            if (isMountedRef.current) {
              setMessages(prev => {
                const newMessages = [...prev];
                if (newMessages.length > 0) {
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: fullContent,
                  };
                }
                return newMessages;
              });

              // Call onChunk callback if provided
              options?.onChunk?.(chunk.content);
            }
          } else if (chunk.type === 'done') {
            if (isMountedRef.current) {
              setIsStreaming(false);
              // Update usage information from the done event
              if (chunk.usage) {
                setUsage(chunk.usage);
              }
            }
            break;
          }
        }
      } else {
        // Non-streaming mode (explicitly disabled)
        const response = await chatSync(allMessages, chatOptions);

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: response.content,
          };
          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
          // Update usage information from the response
          if (response.usage) {
            setUsage(response.usage);
          }
        }
      }
    } catch (err) {
      // Only update state if component is still mounted and request wasn't aborted
      if (
        isMountedRef.current &&
        err instanceof Error &&
        err.name !== 'AbortError'
      ) {
        setError(err);
        setIsLoading(false);
        setIsStreaming(false);
        // Remove the optimistically added messages on error
        setMessages(prev => prev.slice(0, -2)); // Remove user and assistant messages
        // Restore the input so user can retry
        setInput(userMessage.content);
      }
    }
  }, [input, isLoading, isStreaming, messages, options]);

  const clear = useCallback(() => {
    setMessages([]);
    setInput('');
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    setUsage(null);
    // Cancel any pending requests
    abortControllerRef.current?.abort();
  }, []);

  // Token management functions using the baseURL from options
  const clearToken = useCallback(() => {
    clearAuthToken(options?.baseURL);
  }, [options?.baseURL]);

  const checkValidToken = useCallback(() => {
    return hasValidToken(options?.baseURL);
  }, [options?.baseURL]);

  const getTokenInfoCallback = useCallback(() => {
    return getTokenInfo(options?.baseURL);
  }, [options?.baseURL]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    isStreaming,
    error,
    usage,
    send,
    clear,
    clearToken,
    hasValidToken: checkValidToken,
    getTokenInfo: getTokenInfoCallback,
  };
}
