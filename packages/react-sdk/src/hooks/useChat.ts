import { useState, useCallback, useRef, useEffect } from 'react';
import {
  chat,
  chatStream,
  clearAuthToken,
  hasValidToken,
  getTokenInfo,
} from '@airbolt/sdk';
import type { UseChatOptions, UseChatReturn, Message } from '../types/index.js';

/**
 * React hook for managing chat conversations with Airbolt
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
 *     clearToken,
 *     hasValidToken,
 *     getTokenInfo
 *   } = useChat({
 *     system: 'You are a helpful assistant'
 *   });
 *
 *   return (
 *     <div>
 *       <div>Auth Status: {hasValidToken() ? 'Authenticated' : 'Not authenticated'}</div>
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
      const chatOptions: Parameters<typeof chat>[1] = {};
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

      if (options?.streaming) {
        // Streaming mode
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

        for await (const chunk of chatStream(allMessages, chatOptions)) {
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
              options.onChunk?.(chunk.content);
            }
          } else if (chunk.type === 'done') {
            if (isMountedRef.current) {
              setIsStreaming(false);
            }
            break;
          }
        }
      } else {
        // Non-streaming mode (existing logic)
        const response = await chat(allMessages, chatOptions);

        // Only update state if component is still mounted
        if (isMountedRef.current) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: response,
          };
          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
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
    send,
    clear,
    clearToken,
    hasValidToken: checkValidToken,
    getTokenInfo: getTokenInfoCallback,
  };
}
