import { useState, useCallback, useRef, useEffect } from 'react';
import { chat } from '@airbolt/sdk';
import type { UseChatOptions, UseChatReturn, Message } from '../types/index.js';

/**
 * React hook for managing chat conversations with Airbolt
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { messages, input, setInput, send, isLoading } = useChat({
 *     system: 'You are a helpful assistant'
 *   });
 *
 *   return (
 *     <div>
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
  const [error, setError] = useState<Error | null>(null);

  // Use ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Track abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests on unmount
      abortControllerRef.current?.abort();
    };
  }, []);

  const send = useCallback(async () => {
    if (!input.trim() || isLoading) {
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
      // Call the SDK chat function with all messages
      const allMessages = [...messages, userMessage];
      const chatOptions: Parameters<typeof chat>[1] = {};
      if (options?.baseURL) {
        chatOptions.baseURL = options.baseURL;
      }
      if (options?.system) {
        chatOptions.system = options.system;
      }
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
    } catch (err) {
      // Only update state if component is still mounted and request wasn't aborted
      if (
        isMountedRef.current &&
        err instanceof Error &&
        err.name !== 'AbortError'
      ) {
        setError(err);
        setIsLoading(false);
        // Remove the optimistically added user message on error
        setMessages(prev => prev.slice(0, -1));
        // Restore the input so user can retry
        setInput(userMessage.content);
      }
    }
  }, [input, isLoading, messages, options]);

  const clear = useCallback(() => {
    setMessages([]);
    setInput('');
    setError(null);
    setIsLoading(false);
    // Cancel any pending requests
    abortControllerRef.current?.abort();
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    send,
    clear,
  };
}
