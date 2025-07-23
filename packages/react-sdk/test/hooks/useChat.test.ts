import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from '../../src/hooks/useChat.js';
import type { Message } from '@airbolt/sdk';

// Mock the SDK functions
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

import {
  chat,
  clearAuthToken,
  hasValidToken,
  getTokenInfo,
} from '@airbolt/sdk';
const mockChat = vi.mocked(chat);
// const mockChatSync = vi.mocked(chatSync); // Not used in these tests
const mockClearAuthToken = vi.mocked(clearAuthToken);
const mockHasValidToken = vi.mocked(hasValidToken);
const mockGetTokenInfo = vi.mocked(getTokenInfo);

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default states
    mockHasValidToken.mockReturnValue(true);
    mockGetTokenInfo.mockReturnValue({
      hasToken: true,
      expiresAt: new Date(Date.now() + 3600000),
      tokenType: 'Bearer',
    });
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
    // Mock streaming response
    mockChat.mockImplementation(async function* () {
      yield { content: 'Hello! ', type: 'chunk' };
      yield { content: 'How can I help you?', type: 'chunk' };
      yield { content: '', type: 'done' };
    });

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
    mockChat.mockImplementation(async function* () {
      throw testError;
    });

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
    // Mock a slow streaming response
    mockChat.mockImplementation(async function* () {
      await new Promise(resolve => setTimeout(resolve, 100));
      yield { content: 'Response', type: 'chunk' };
      yield { content: '', type: 'done' };
    });

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
    mockChat.mockImplementation(async function* () {
      yield { content: 'Response', type: 'chunk' };
      yield { content: '', type: 'done' };
    });
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
    let callCount = 0;
    mockChat.mockImplementation(async function* () {
      callCount++;
      if (callCount === 1) {
        yield { content: 'First response', type: 'chunk' };
      } else {
        yield { content: 'Second response', type: 'chunk' };
      }
      yield { content: '', type: 'done' };
    });

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
    // Mock a slow streaming response
    mockChat.mockImplementation(async function* () {
      await new Promise(resolve => setTimeout(resolve, 100));
      yield { content: 'Response', type: 'chunk' };
      yield { content: '', type: 'done' };
    });

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
    mockChat.mockImplementation(async function* () {
      throw abortError;
    });

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
    mockChat.mockImplementation(async function* () {
      yield { content: 'Response', type: 'chunk' };
      yield { content: '', type: 'done' };
    });

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

  describe('Authentication token management', () => {
    it('should expose token management functions', () => {
      const { result } = renderHook(() => useChat());

      expect(typeof result.current.clearToken).toBe('function');
      expect(typeof result.current.hasValidToken).toBe('function');
      expect(typeof result.current.getTokenInfo).toBe('function');
    });

    it('should call clearAuthToken with correct baseURL', () => {
      const customBaseURL = 'https://api.example.com';
      const { result } = renderHook(() => useChat({ baseURL: customBaseURL }));

      act(() => {
        result.current.clearToken();
      });

      expect(mockClearAuthToken).toHaveBeenCalledWith(customBaseURL);
    });

    it('should call clearAuthToken with undefined when no baseURL provided', () => {
      const { result } = renderHook(() => useChat());

      act(() => {
        result.current.clearToken();
      });

      expect(mockClearAuthToken).toHaveBeenCalledWith(undefined);
    });

    it('should call hasValidToken with correct baseURL', () => {
      const customBaseURL = 'https://api.example.com';
      const { result } = renderHook(() => useChat({ baseURL: customBaseURL }));

      const isValid = result.current.hasValidToken();

      expect(mockHasValidToken).toHaveBeenCalledWith(customBaseURL);
      expect(isValid).toBe(true);
    });

    it('should call getTokenInfo with correct baseURL', () => {
      const customBaseURL = 'https://api.example.com';
      const expectedTokenInfo = {
        hasToken: true,
        expiresAt: new Date(),
        tokenType: 'Bearer',
      };
      mockGetTokenInfo.mockReturnValue(expectedTokenInfo);

      const { result } = renderHook(() => useChat({ baseURL: customBaseURL }));

      const tokenInfo = result.current.getTokenInfo();

      expect(mockGetTokenInfo).toHaveBeenCalledWith(customBaseURL);
      expect(tokenInfo).toEqual(expectedTokenInfo);
    });

    it('should update token functions when baseURL changes', () => {
      const { result, rerender } = renderHook(
        ({ baseURL }) => useChat({ baseURL }),
        { initialProps: { baseURL: 'https://api1.example.com' } }
      );

      // Clear mocks to isolate baseURL change behavior
      vi.clearAllMocks();

      rerender({ baseURL: 'https://api2.example.com' });

      act(() => {
        result.current.clearToken();
      });

      expect(mockClearAuthToken).toHaveBeenCalledWith(
        'https://api2.example.com'
      );
    });

    it('should handle token operations after component unmount', () => {
      const { result, unmount } = renderHook(() => useChat());

      // Get references to functions before unmount
      const clearToken = result.current.clearToken;
      const hasValidToken = result.current.hasValidToken;
      const getTokenInfo = result.current.getTokenInfo;

      unmount();

      // Functions should still work (they're bound to client, not component)
      expect(() => clearToken()).not.toThrow();
      expect(() => hasValidToken()).not.toThrow();
      expect(() => getTokenInfo()).not.toThrow();
    });

    it('should handle different authentication states', () => {
      // Test authenticated state
      mockHasValidToken.mockReturnValue(true);
      mockGetTokenInfo.mockReturnValue({
        hasToken: true,
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
      });

      const { result: authenticatedResult } = renderHook(() => useChat());

      expect(authenticatedResult.current.hasValidToken()).toBe(true);
      expect(authenticatedResult.current.getTokenInfo().hasToken).toBe(true);

      // Test unauthenticated state
      mockHasValidToken.mockReturnValue(false);
      mockGetTokenInfo.mockReturnValue({
        hasToken: false,
      });

      const { result: unauthenticatedResult } = renderHook(() => useChat());

      expect(unauthenticatedResult.current.hasValidToken()).toBe(false);
      expect(unauthenticatedResult.current.getTokenInfo().hasToken).toBe(false);
    });

    it('should support complete authentication lifecycle', async () => {
      const { result } = renderHook(() =>
        useChat({
          baseURL: 'https://api.example.com',
        })
      );

      // Initially authenticated
      expect(result.current.hasValidToken()).toBe(true);

      // Use chat functionality while authenticated
      mockChat.mockImplementation(async function* () {
        yield { content: 'Hello! I can help you.', type: 'chunk' };
        yield { content: '', type: 'done' };
      });
      act(() => result.current.setInput('Hi'));
      await act(async () => await result.current.send());

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toEqual({
        role: 'user',
        content: 'Hi',
      });

      // Logout
      act(() => result.current.clearToken());
      expect(mockClearAuthToken).toHaveBeenCalledWith(
        'https://api.example.com'
      );

      // Verify token state after logout
      mockHasValidToken.mockReturnValue(false);
      expect(result.current.hasValidToken()).toBe(false);
    });

    it('should handle token function errors gracefully', () => {
      // Mock token functions to throw errors
      mockClearAuthToken.mockImplementation(() => {
        throw new Error('Clear token failed');
      });
      mockHasValidToken.mockImplementation(() => {
        throw new Error('Check token failed');
      });
      mockGetTokenInfo.mockImplementation(() => {
        throw new Error('Get token info failed');
      });

      const { result } = renderHook(() => useChat());

      // Functions should propagate errors (caller should handle them)
      expect(() => result.current.clearToken()).toThrow('Clear token failed');
      expect(() => result.current.hasValidToken()).toThrow(
        'Check token failed'
      );
      expect(() => result.current.getTokenInfo()).toThrow(
        'Get token info failed'
      );
    });

    it('should maintain function reference stability with useCallback', () => {
      const { result, rerender } = renderHook(
        ({ baseURL }) => useChat({ baseURL }),
        { initialProps: { baseURL: 'https://api.example.com' } }
      );

      const clearToken1 = result.current.clearToken;
      const hasValidToken1 = result.current.hasValidToken;
      const getTokenInfo1 = result.current.getTokenInfo;

      // Rerender with same props - functions should be stable
      rerender({ baseURL: 'https://api.example.com' });

      expect(result.current.clearToken).toBe(clearToken1);
      expect(result.current.hasValidToken).toBe(hasValidToken1);
      expect(result.current.getTokenInfo).toBe(getTokenInfo1);

      // Rerender with different baseURL - functions should update
      rerender({ baseURL: 'https://api2.example.com' });

      expect(result.current.clearToken).not.toBe(clearToken1);
      expect(result.current.hasValidToken).not.toBe(hasValidToken1);
      expect(result.current.getTokenInfo).not.toBe(getTokenInfo1);
    });
  });
});
