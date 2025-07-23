import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from '../../src/hooks/useChat.js';

// Mock the SDK
vi.mock('@airbolt/sdk', () => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
  clearAuthToken: vi.fn(),
  hasValidToken: vi.fn(() => true),
  getTokenInfo: vi.fn(() => ({
    hasToken: true,
    expiresAt: new Date(Date.now() + 3600000),
    tokenType: 'Bearer',
  })),
}));

import { chatStream, hasValidToken, getTokenInfo } from '@airbolt/sdk';
const mockChatStream = vi.mocked(chatStream);
const mockHasValidToken = vi.mocked(hasValidToken);
const mockGetTokenInfo = vi.mocked(getTokenInfo);

describe('useChat streaming', () => {
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

  it('should handle streaming responses', async () => {
    // Mock chatStream to return an async generator
    mockChatStream.mockImplementation(async function* () {
      yield { content: 'Hello', type: 'chunk' };
      yield { content: ' streaming', type: 'chunk' };
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

    // Set input and send message
    act(() => {
      result.current.setInput('Test message');
    });

    await act(async () => {
      await result.current.send();
    });

    // Wait for streaming to complete
    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    // Check that the message was accumulated correctly
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toEqual({
      role: 'assistant',
      content: 'Hello streaming world!',
    });

    // Check that onChunk was called for each chunk
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onChunk).toHaveBeenNthCalledWith(2, ' streaming');
    expect(onChunk).toHaveBeenNthCalledWith(3, ' world!');

    // Check states
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should show streaming state during stream', async () => {
    let resolveStream: () => void;
    const streamPromise = new Promise<void>(resolve => {
      resolveStream = resolve;
    });

    // Mock chatStream with controlled timing
    mockChatStream.mockImplementation(async function* () {
      yield { content: 'Start', type: 'chunk' };
      await streamPromise;
      yield { content: '', type: 'done' };
    });

    const { result } = renderHook(() => useChat({ streaming: true }));

    // Set input first
    act(() => {
      result.current.setInput('Test');
    });

    // Start sending - don't await yet
    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.send();
    });

    // Wait a bit for the stream to start
    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true);
    });
    expect(result.current.isLoading).toBe(false);

    // Resolve the stream
    act(() => {
      resolveStream!();
    });

    // Wait for send to complete
    await act(async () => {
      await sendPromise!;
    });

    // Check streaming state is false after completion
    expect(result.current.isStreaming).toBe(false);
  });

  it('should handle streaming errors', async () => {
    // Mock chatStream to throw an error
    mockChatStream.mockImplementation(async function* () {
      yield { content: 'Start', type: 'chunk' };
      throw new Error('Stream failed');
    });

    const { result } = renderHook(() => useChat({ streaming: true }));

    // Ensure hook is rendered first
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    act(() => {
      result.current.setInput('Test message');
    });

    await act(async () => {
      await result.current.send();
    });

    // Wait for error state
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.message).toBe('Stream failed');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isLoading).toBe(false);
    // Messages should be rolled back on error
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.input).toBe('Test message'); // Input restored
  });

  it('should disable input during streaming', async () => {
    let resolveStream: () => void;
    const streamPromise = new Promise<void>(resolve => {
      resolveStream = resolve;
    });

    mockChatStream.mockImplementation(async function* () {
      await streamPromise;
      yield { content: 'Response', type: 'chunk' };
      yield { content: '', type: 'done' };
    });

    const { result } = renderHook(() => useChat({ streaming: true }));

    // Ensure hook is rendered first
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Send first message
    act(() => {
      result.current.setInput('First message');
    });

    let firstSend: Promise<void>;
    await act(async () => {
      firstSend = result.current.send();
    });

    // Try to send another message while streaming
    act(() => {
      result.current.setInput('Second message');
    });

    await act(async () => {
      await result.current.send(); // This should be ignored
    });

    // Verify only one call to chatStream
    expect(mockChatStream).toHaveBeenCalledTimes(1);

    // Complete the first stream
    act(() => {
      resolveStream!();
    });

    await act(async () => {
      await firstSend!;
    });

    // Now sending should work again
    await act(async () => {
      await result.current.send();
    });

    expect(mockChatStream).toHaveBeenCalledTimes(2);
  });
});
