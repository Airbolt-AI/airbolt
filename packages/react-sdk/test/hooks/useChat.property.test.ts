import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import { useChat } from '../../src/hooks/useChat.js';
import type { Message } from '@airbolt/sdk';

// Mock the SDK chat function
vi.mock('@airbolt/sdk', () => ({
  chat: vi.fn(),
}));

import { chat } from '@airbolt/sdk';
const mockChat = vi.mocked(chat);

describe('useChat property-based tests', () => {
  // Property: Any non-empty string input should create a user message
  it('should handle any valid string input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async inputText => {
          vi.clearAllMocks();
          mockChat.mockResolvedValueOnce('Response');
          const { result } = renderHook(() => useChat());

          act(() => {
            result.current.setInput(inputText);
          });

          await act(async () => {
            await result.current.send();
          });

          await waitFor(() => {
            const userMessage = result.current.messages.find(
              m => m.role === 'user'
            );
            expect(userMessage).toBeDefined();
            expect(userMessage?.content).toBe(inputText.trim());
          });

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property: Initial messages should always be preserved
  it('should preserve initial messages through operations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constantFrom('user' as const, 'assistant' as const),
            content: fc.string({ minLength: 1 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (initialMessages: Message[]) => {
          const { result } = renderHook(() => useChat({ initialMessages }));

          // Initial messages should be preserved
          expect(result.current.messages).toEqual(initialMessages);

          // Clear should remove all messages including initial
          act(() => {
            result.current.clear();
          });

          expect(result.current.messages).toEqual([]);
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property: Empty or whitespace-only inputs should not create messages
  it('should not send empty or whitespace messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().map(s => s.replace(/[^\s]/g, ' ')), // Create whitespace-only strings
        async whitespaceInput => {
          vi.clearAllMocks();
          const { result } = renderHook(() => useChat());

          act(() => {
            result.current.setInput(whitespaceInput);
          });

          await act(async () => {
            await result.current.send();
          });

          expect(mockChat).not.toHaveBeenCalled();
          expect(result.current.messages).toHaveLength(0);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  // Property: System prompt should always be passed to chat function
  it('should always include system prompt if provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (systemPrompt, userInput) => {
          vi.clearAllMocks();
          mockChat.mockResolvedValueOnce('Response');
          const { result } = renderHook(() =>
            useChat({ system: systemPrompt })
          );

          act(() => {
            result.current.setInput(userInput);
          });

          await act(async () => {
            await result.current.send();
          });

          await waitFor(() => {
            expect(mockChat).toHaveBeenCalledWith(
              expect.any(Array),
              expect.objectContaining({ system: systemPrompt })
            );
          });

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  // Property: Error states should be recoverable
  it('should recover from errors on subsequent successful sends', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async (firstInput, secondInput) => {
          vi.clearAllMocks();
          const { result } = renderHook(() => useChat());

          // First send fails
          mockChat.mockRejectedValueOnce(new Error('Test error'));

          act(() => {
            result.current.setInput(firstInput);
          });

          await act(async () => {
            await result.current.send();
          });

          await waitFor(() => {
            expect(result.current.error).toBeTruthy();
          });

          // Second send succeeds
          mockChat.mockResolvedValueOnce('Success response');

          act(() => {
            result.current.setInput(secondInput);
          });

          await act(async () => {
            await result.current.send();
          });

          await waitFor(() => {
            expect(result.current.error).toBeNull();
            expect(result.current.messages).toHaveLength(2);
          });

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  // Property: Message history should grow monotonically (never decrease except on clear)
  it('should maintain message history monotonically', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 5 }
        ),
        async inputs => {
          vi.clearAllMocks();
          const { result } = renderHook(() => useChat());
          let previousLength = 0;

          for (const input of inputs) {
            mockChat.mockResolvedValueOnce(`Response to: ${input}`);

            act(() => {
              result.current.setInput(input);
            });

            await act(async () => {
              await result.current.send();
            });

            await waitFor(() => {
              const currentLength = result.current.messages.length;
              expect(currentLength).toBeGreaterThan(previousLength);
              previousLength = currentLength;
            });
          }

          // After all inputs, we should have 2 * inputs.length messages
          expect(result.current.messages).toHaveLength(inputs.length * 2);

          return true;
        }
      ),
      { numRuns: 10 }
    );
  });
});
