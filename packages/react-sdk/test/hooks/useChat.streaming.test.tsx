import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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

describe('useChat streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should stream messages when streaming option is enabled', async () => {
    // Mock chatStream to return chunks
    mockChat.mockImplementation(async function* () {
      yield { content: 'Hello', type: 'chunk' };
      yield { content: ' world!', type: 'chunk' };
      yield { content: '', type: 'done' };
    });

    const onChunk = vi.fn();
    const { result } = renderHook(() =>
      useChat({
        streaming: true,
        onChunk,
      })
    );

    act(() => {
      result.current.setInput('Test message');
    });

    await act(async () => {
      await result.current.send();
    });

    // Check that streaming worked
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toEqual({
      role: 'assistant',
      content: 'Hello world!',
    });

    // Check callbacks were called
    expect(onChunk).toHaveBeenCalledWith('Hello');
    expect(onChunk).toHaveBeenCalledWith(' world!');
  });

  it('should handle streaming errors', async () => {
    // Mock error during streaming
    mockChat.mockImplementation(async function* () {
      yield { content: 'Start', type: 'chunk' };
      throw new Error('Stream failed');
    });

    const { result } = renderHook(() => useChat({ streaming: true }));

    act(() => {
      result.current.setInput('Test message');
    });

    await act(async () => {
      await result.current.send();
    });

    // Check error handling
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.message).toBe('Stream failed');
    expect(result.current.messages).toHaveLength(0); // Rolled back
    expect(result.current.input).toBe('Test message'); // Input restored
  });
});
