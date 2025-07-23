import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import { useChat } from '../../src/hooks/useChat.js';
import type { Message } from '@airbolt/sdk';

// Mock the SDK functions
vi.mock('@airbolt/sdk', () => ({
  chat: vi.fn(),
  clearAuthToken: vi.fn(),
  hasValidToken: vi.fn(() => true),
  getTokenInfo: vi.fn(() => ({
    hasToken: true,
    expiresAt: new Date(Date.now() + 3600000),
    tokenType: 'Bearer',
  })),
}));

import {
  chat,
  clearAuthToken,
  hasValidToken,
  getTokenInfo,
} from '@airbolt/sdk';
const mockChat = vi.mocked(chat);
const mockClearAuthToken = vi.mocked(clearAuthToken);
const mockHasValidToken = vi.mocked(hasValidToken);
const mockGetTokenInfo = vi.mocked(getTokenInfo);

describe('useChat property-based tests', () => {
  // Property: Any non-empty string input should create a user message
  it('should handle any valid string input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        async inputText => {
          vi.clearAllMocks();
          mockChat.mockImplementation(async function* () {
            yield { content: 'Response', type: 'chunk' };
            yield { content: '', type: 'done' };
          });
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
          mockChat.mockImplementation(async function* () {
            yield { content: 'Response', type: 'chunk' };
            yield { content: '', type: 'done' };
          });
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
          mockChat.mockImplementation(async function* () {
            yield { content: 'Success response', type: 'chunk' };
            yield { content: '', type: 'done' };
          });

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
            mockChat.mockImplementation(async function* () {
              yield { content: `Response to: ${input}`, type: 'chunk' };
              yield { content: '', type: 'done' };
            });

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

  describe('Token management property-based tests', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Reset to default behavior
      mockHasValidToken.mockReturnValue(true);
      mockGetTokenInfo.mockReturnValue({
        hasToken: true,
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
      });
      mockClearAuthToken.mockImplementation(() => {});
    });
    // Property: Token operations should work with any valid URL
    it('should handle token operations with arbitrary URLs', () => {
      fc.assert(
        fc.property(fc.webUrl(), (baseURL: string) => {
          vi.clearAllMocks();
          const { result } = renderHook(() => useChat({ baseURL }));

          // All token operations should work without throwing
          expect(() => {
            act(() => {
              result.current.clearToken();
              result.current.hasValidToken();
              result.current.getTokenInfo();
            });
          }).not.toThrow();

          // SDK functions should be called with the provided URL
          expect(mockClearAuthToken).toHaveBeenCalledWith(baseURL);
          expect(mockHasValidToken).toHaveBeenCalledWith(baseURL);
          expect(mockGetTokenInfo).toHaveBeenCalledWith(baseURL);
        }),
        { numRuns: 30 }
      );
    });

    // Property: Token state isolation per baseURL
    it('should maintain token isolation per baseURL', () => {
      fc.assert(
        fc.property(fc.webUrl(), fc.webUrl(), (url1: string, url2: string) => {
          fc.pre(url1 !== url2); // Ensure URLs are different

          vi.clearAllMocks();

          const hook1 = renderHook(() => useChat({ baseURL: url1 }));
          const hook2 = renderHook(() => useChat({ baseURL: url2 }));

          // Clear token for URL1
          act(() => {
            hook1.result.current.clearToken();
          });

          // URL2 operations should use different URL
          act(() => {
            hook2.result.current.hasValidToken();
          });

          // Each hook should call with its own URL
          expect(mockClearAuthToken).toHaveBeenCalledWith(url1);
          expect(mockHasValidToken).toHaveBeenCalledWith(url2);
        }),
        { numRuns: 20 }
      );
    });

    // Property: Function stability with identical baseURLs
    it('should reuse function references for identical baseURLs', () => {
      fc.assert(
        fc.property(fc.webUrl(), (baseURL: string) => {
          const { result, rerender } = renderHook(
            ({ url }) => useChat({ baseURL: url }),
            { initialProps: { url: baseURL } }
          );

          const clearToken1 = result.current.clearToken;
          const hasValidToken1 = result.current.hasValidToken;
          const getTokenInfo1 = result.current.getTokenInfo;

          // Rerender with same URL - functions should be stable
          rerender({ url: baseURL });

          expect(result.current.clearToken).toBe(clearToken1);
          expect(result.current.hasValidToken).toBe(hasValidToken1);
          expect(result.current.getTokenInfo).toBe(getTokenInfo1);
        }),
        { numRuns: 20 }
      );
    });

    // Property: Token info structure consistency
    it('should handle arbitrary token info structures', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasToken: fc.boolean(),
            expiresAt: fc.option(fc.date(), { nil: undefined }),
            tokenType: fc.option(fc.string(), { nil: undefined }),
          }),
          tokenInfo => {
            vi.clearAllMocks();
            // Cast to TokenInfo to handle exactOptionalPropertyTypes
            mockGetTokenInfo.mockReturnValue(tokenInfo as any);

            const { result } = renderHook(() => useChat());

            const returnedInfo = result.current.getTokenInfo();

            // Should return exactly what the SDK returns
            expect(returnedInfo).toEqual(tokenInfo);
          }
        ),
        { numRuns: 30 }
      );
    });

    // Property: Error resilience for token operations
    it('should handle token operation errors consistently', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('clearToken', 'hasValidToken', 'getTokenInfo'),
          fc.string({ minLength: 1 }),
          (operation: string, errorMessage: string) => {
            vi.clearAllMocks();

            // Mock the operation to throw
            switch (operation) {
              case 'clearToken':
                mockClearAuthToken.mockImplementation(() => {
                  throw new Error(errorMessage);
                });
                break;
              case 'hasValidToken':
                mockHasValidToken.mockImplementation(() => {
                  throw new Error(errorMessage);
                });
                break;
              case 'getTokenInfo':
                mockGetTokenInfo.mockImplementation(() => {
                  throw new Error(errorMessage);
                });
                break;
            }

            const { result } = renderHook(() => useChat());

            // Error should be propagated consistently
            expect(() => {
              switch (operation) {
                case 'clearToken':
                  result.current.clearToken();
                  break;
                case 'hasValidToken':
                  result.current.hasValidToken();
                  break;
                case 'getTokenInfo':
                  result.current.getTokenInfo();
                  break;
              }
            }).toThrow(errorMessage);
          }
        ),
        { numRuns: 20 }
      );
    });

    // Property: baseURL parameter consistency
    it('should pass baseURL consistently to all token operations', () => {
      fc.assert(
        fc.property(
          fc.option(fc.webUrl(), { nil: undefined }),
          (baseURL: string | undefined) => {
            vi.clearAllMocks();
            const { result } = renderHook(() =>
              useChat(baseURL ? { baseURL } : {})
            );

            // Perform all token operations
            act(() => {
              result.current.clearToken();
              result.current.hasValidToken();
              result.current.getTokenInfo();
            });

            // All operations should receive the same baseURL parameter
            expect(mockClearAuthToken).toHaveBeenCalledWith(baseURL);
            expect(mockHasValidToken).toHaveBeenCalledWith(baseURL);
            expect(mockGetTokenInfo).toHaveBeenCalledWith(baseURL);
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});
