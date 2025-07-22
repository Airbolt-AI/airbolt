import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from '../../src/hooks/useChat.js';
import * as sdk from '@airbolt/sdk';

// Mock the SDK
vi.mock('@airbolt/sdk');

describe('useChat streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle streaming responses', async () => {
    // Mock chatStream to return an async generator
    const mockChatStream = vi.fn().mockImplementation(async function* () {
      yield { content: 'Hello', type: 'chunk' };
      yield { content: ' streaming', type: 'chunk' };
      yield { content: ' world!', type: 'chunk' };
      yield { content: '', type: 'done' };
    });

    vi.spyOn(sdk, 'chatStream').mockImplementation(mockChatStream);

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
    const mockChatStream = vi.fn().mockImplementation(async function* () {
      yield { content: 'Start', type: 'chunk' };
      await streamPromise;
      yield { content: '', type: 'done' };
    });

    vi.spyOn(sdk, 'chatStream').mockImplementation(mockChatStream);

    const { result } = renderHook(() => useChat({ streaming: true }));

    act(() => {
      result.current.setInput('Test');
    });

    const sendPromise = act(async () => {
      await result.current.send();
    });

    // Check streaming state is true
    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true);
    });
    expect(result.current.isLoading).toBe(false);

    // Resolve the stream
    act(() => {
      resolveStream!();
    });

    await sendPromise;

    // Check streaming state is false after completion
    expect(result.current.isStreaming).toBe(false);
  });

  it('should handle streaming errors', async () => {
    // Mock chatStream to throw an error
    const mockChatStream = vi.fn().mockImplementation(async function* () {
      yield { content: 'Start', type: 'chunk' };
      throw new Error('Stream failed');
    });

    vi.spyOn(sdk, 'chatStream').mockImplementation(mockChatStream);

    const { result } = renderHook(() => useChat({ streaming: true }));

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

    const mockChatStream = vi.fn().mockImplementation(async function* () {
      await streamPromise;
      yield { content: 'Response', type: 'chunk' };
      yield { content: '', type: 'done' };
    });

    vi.spyOn(sdk, 'chatStream').mockImplementation(mockChatStream);

    const { result } = renderHook(() => useChat({ streaming: true }));

    // Send first message
    act(() => {
      result.current.setInput('First message');
    });

    const firstSend = act(async () => {
      await result.current.send();
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

    await firstSend;

    // Now sending should work again
    await act(async () => {
      await result.current.send();
    });

    expect(mockChatStream).toHaveBeenCalledTimes(2);
  });
});
