import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from '../../src/hooks/useChat.js';
import type { Message } from '@airbolt/sdk';

// Mock the SDK chat function
vi.mock('@airbolt/sdk', () => ({
  chat: vi.fn(),
}));

import { chat } from '@airbolt/sdk';
const mockChat = vi.mocked(chat);

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.input).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.send).toBe('function');
    expect(typeof result.current.clear).toBe('function');
    expect(typeof result.current.setInput).toBe('function');
  });

  it('should initialize with provided initial messages', () => {
    const initialMessages: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    const { result } = renderHook(() => useChat({ initialMessages }));

    expect(result.current.messages).toEqual(initialMessages);
  });

  it('should update input value', () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setInput('Hello, world!');
    });

    expect(result.current.input).toBe('Hello, world!');
  });

  it('should send a message successfully', async () => {
    mockChat.mockResolvedValueOnce('Hello! How can I help you?');

    const { result } = renderHook(() => useChat({ system: 'You are helpful' }));

    // Set input
    act(() => {
      result.current.setInput('Hello');
    });

    // Send message
    await act(async () => {
      await result.current.send();
    });

    // Wait for the state updates
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toEqual({
        role: 'user',
        content: 'Hello',
      });
      expect(result.current.messages[1]).toEqual({
        role: 'assistant',
        content: 'Hello! How can I help you?',
      });
      expect(result.current.input).toBe('');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    // Verify SDK was called correctly
    expect(mockChat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hello' }],
      { system: 'You are helpful' }
    );
  });

  it('should handle errors properly', async () => {
    const testError = new Error('Network error');
    mockChat.mockRejectedValueOnce(testError);

    const { result } = renderHook(() => useChat());

    // Set input
    act(() => {
      result.current.setInput('Hello');
    });

    // Send message
    await act(async () => {
      await result.current.send();
    });

    // Wait for error state
    await waitFor(() => {
      expect(result.current.error).toEqual(testError);
      expect(result.current.messages).toHaveLength(0); // User message removed on error
      expect(result.current.input).toBe('Hello'); // Input restored
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should not send empty messages', async () => {
    const { result } = renderHook(() => useChat());

    // Try to send with empty input
    act(() => {
      result.current.setInput('   '); // Only whitespace
    });

    await act(async () => {
      await result.current.send();
    });

    expect(mockChat).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it('should not send while loading', async () => {
    // Mock a slow response
    mockChat.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('Response'), 100))
    );

    const { result } = renderHook(() => useChat());

    // Set input and send first message
    act(() => {
      result.current.setInput('First message');
    });

    act(() => {
      void result.current.send();
    });

    // Try to send another message while loading
    act(() => {
      result.current.setInput('Second message');
    });

    await act(async () => {
      await result.current.send();
    });

    // Should only have called chat once
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('should clear all messages and state', () => {
    const { result } = renderHook(() =>
      useChat({
        initialMessages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      })
    );

    // Set some state
    act(() => {
      result.current.setInput('New message');
    });

    // Clear everything
    act(() => {
      result.current.clear();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.input).toBe('');
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should pass baseURL option to chat function', async () => {
    mockChat.mockResolvedValueOnce('Response');
    const customBaseURL = 'https://api.example.com';

    const { result } = renderHook(() => useChat({ baseURL: customBaseURL }));

    act(() => {
      result.current.setInput('Test');
    });

    await act(async () => {
      await result.current.send();
    });

    expect(mockChat).toHaveBeenCalledWith([{ role: 'user', content: 'Test' }], {
      baseURL: customBaseURL,
    });
  });

  it('should maintain message history across multiple sends', async () => {
    mockChat
      .mockResolvedValueOnce('First response')
      .mockResolvedValueOnce('Second response');

    const { result } = renderHook(() => useChat());

    // First message
    act(() => {
      result.current.setInput('First');
    });

    await act(async () => {
      await result.current.send();
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    // Second message
    act(() => {
      result.current.setInput('Second');
    });

    await act(async () => {
      await result.current.send();
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(4);
      expect(mockChat).toHaveBeenLastCalledWith(
        [
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second' },
        ],
        {}
      );
    });
  });

  it('should handle component unmount gracefully', async () => {
    // Mock a slow response
    mockChat.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('Response'), 100))
    );

    const { result, unmount } = renderHook(() => useChat());

    // Set input and send
    act(() => {
      result.current.setInput('Test');
    });

    act(() => {
      void result.current.send();
    });

    // Unmount before response
    unmount();

    // Wait to ensure no errors occur
    await new Promise(resolve => setTimeout(resolve, 150));

    // No assertions needed - test passes if no errors thrown
  });

  it('should handle AbortError without setting error state', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockChat.mockRejectedValueOnce(abortError);

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setInput('Test');
    });

    await act(async () => {
      await result.current.send();
    });

    // Should not set error for AbortError
    expect(result.current.error).toBeNull();
  });

  it('should trim whitespace from input messages', async () => {
    mockChat.mockResolvedValueOnce('Response');

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setInput('  Hello world  ');
    });

    await act(async () => {
      await result.current.send();
    });

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe('Hello world');
    });

    expect(mockChat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hello world' }],
      {}
    );
  });
});
