import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import { useChat } from '../../src/hooks/useChat.js';

// Mock the SDK
vi.mock('@airbolt/sdk', () => ({
  chat: vi.fn(),
  chatSync: vi.fn(),
  clearAuthToken: vi.fn(),
  hasValidToken: vi.fn(() => true),
  getTokenInfo: vi.fn(() => ({
    hasToken: true,
    expiresAt: new Date(Date.now() + 3600000),
    tokenType: 'Bearer',
  })),
}));

import { chat } from '@airbolt/sdk';
const mockChat = vi.mocked(chat);

describe('useChat streaming property tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // HIGHEST VALUE TEST: Validates ALL streaming patterns work correctly
  it('should handle any valid streaming pattern', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various chunk patterns
        fc
          .array(
            fc.oneof(
              // Regular content chunks
              fc.record({
                content: fc.string({ minLength: 0, maxLength: 100 }),
                type: fc.constant('chunk' as const),
              }),
              // Done signal
              fc.record({
                content: fc.constant(''),
                type: fc.constant('done' as const),
              })
            ),
            { minLength: 1, maxLength: 20 }
          )
          .map(chunks => {
            // Ensure 'done' is always last
            const hasValidDone = chunks.some(c => c.type === 'done');
            if (!hasValidDone) {
              return [...chunks, { content: '', type: 'done' as const }];
            }
            // Remove any chunks after first 'done'
            const doneIndex = chunks.findIndex(c => c.type === 'done');
            return chunks.slice(0, doneIndex + 1);
          }),
        // Whether to throw an error during streaming
        fc.boolean(),
        // Test with different timing patterns
        fc.array(fc.integer({ min: 0, max: 50 }), {
          minLength: 1,
          maxLength: 20,
        }),
        async (chunks, shouldError, delays) => {
          mockChat.mockImplementation(async function* () {
            // Throw error before first chunk if shouldError is true
            if (shouldError) {
              throw new Error('Stream error');
            }

            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              if (!chunk) continue;

              const delay = delays[i % delays.length];
              if (delay) {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
              yield chunk;
              if (chunk.type === 'done') {
                break;
              }
            }
          });

          const { result } = renderHook(() => useChat());

          act(() => {
            result.current.setInput('Test message');
          });

          await act(async () => {
            await result.current.send();
          });

          await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
          });

          // Verify final state is correct regardless of chunk pattern
          const expectedContent = chunks
            .filter(c => c.type === 'chunk')
            .map(c => c.content || '')
            .join('');

          if (shouldError) {
            expect(result.current.error).toBeTruthy();
            expect(result.current.messages).toHaveLength(0); // Rolled back
          } else {
            expect(result.current.error).toBeNull();
            expect(result.current.messages).toHaveLength(2);
            expect(result.current.messages[1]?.content).toBe(expectedContent); // Handle empty content
          }
        }
      ),
      { numRuns: 100 } // Test 100 random patterns
    );
  });

  // Test that hook prevents concurrent requests
  it('should prevent concurrent streaming requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 2,
          maxLength: 5,
        }),
        async messages => {
          let resolveFirst: (() => void) | undefined;
          const firstCallPromise = new Promise<void>(resolve => {
            resolveFirst = resolve;
          });

          let callCount = 0;
          mockChat.mockImplementation(async function* () {
            const currentCall = callCount++;
            if (currentCall === 0) {
              // First call waits
              await firstCallPromise;
            }
            yield {
              content: messages[currentCall % messages.length] || '',
              type: 'chunk' as const,
            };
            yield { content: '', type: 'done' };
          });

          const { result } = renderHook(() => useChat());

          // Start first request
          act(() => {
            result.current.setInput('First message');
          });

          let firstSendPromise: Promise<void>;
          await act(async () => {
            firstSendPromise = result.current.send();
          });

          // Try second request while first is loading
          act(() => {
            result.current.setInput('Second message');
          });

          await act(async () => {
            await result.current.send(); // Should be ignored
          });

          // Complete first request
          resolveFirst?.();
          await firstSendPromise!;

          // Only first request should have completed
          expect(callCount).toBe(1);
          expect(result.current.messages).toHaveLength(2);
          expect(result.current.messages[0]?.content).toBe('First message');
          expect(result.current.isLoading).toBe(false);
        }
      )
    );
  });

  // Test Unicode/emoji handling across chunk boundaries
  it('should handle Unicode correctly across chunk boundaries', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings with emojis and Unicode
        fc.oneof(
          fc.string({ minLength: 1, maxLength: 20 }), // Regular strings
          fc.constantFrom(
            'Hello',
            '😀🎉',
            '你好世界',
            'Test❤️',
            '🚀Rocket',
            'Mixed中文Text'
          ) // Strings with Unicode/emojis
        ),
        fc.integer({ min: 1, max: 5 }), // How many chunks to split into
        async (unicodeString, chunkCount) => {
          mockChat.mockImplementation(async function* () {
            const chunkSize = Math.ceil(unicodeString.length / chunkCount);
            for (let i = 0; i < unicodeString.length; i += chunkSize) {
              yield {
                content: unicodeString.slice(i, i + chunkSize),
                type: 'chunk',
              };
            }
            yield { content: '', type: 'done' };
          });

          const { result } = renderHook(() => useChat());

          act(() => {
            result.current.setInput('Test');
          });

          await act(async () => {
            await result.current.send();
          });

          await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
          });

          // Final content should match original regardless of chunking
          expect(result.current.messages[1]?.content).toBe(unicodeString);
        }
      )
    );
  });

  // Test component unmounting during streaming
  it('should handle unmounting safely during streaming', async () => {
    // Simple test without property-based complexity
    let resolveStream: (() => void) | undefined;
    const streamPromise = new Promise<void>(resolve => {
      resolveStream = resolve;
    });

    mockChat.mockImplementation(async function* () {
      yield { content: 'Start', type: 'chunk' };
      await streamPromise; // Wait for unmount
      yield { content: ' End', type: 'chunk' };
      yield { content: '', type: 'done' };
    });

    const { result, unmount } = renderHook(() => useChat());

    act(() => {
      result.current.setInput('Test');
    });

    // Start streaming
    act(() => {
      void result.current.send();
    });

    // Unmount while streaming
    unmount();

    // Complete the stream after unmount
    resolveStream?.();

    // No errors should occur
    await new Promise(resolve => setTimeout(resolve, 100));
  });
});
