import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chatStream } from '../src/api/chat.js';
import type { Message } from '../src/api/types.js';

describe('chatStream', () => {
  const mockBaseURL = 'http://localhost:3000';
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should stream chat responses', async () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    // Mock SSE response
    const mockSSEData = [
      'event: start\ndata: {"type":"start"}\n\n',
      'event: chunk\ndata: {"content":"Hello"}\n\n',
      'event: chunk\ndata: {"content":" world"}\n\n',
      'event: done\ndata: {"usage":{"total_tokens":5}}\n\n',
    ];

    // Create a mock readable stream
    const mockStream = new ReadableStream({
      async start(controller) {
        for (const chunk of mockSSEData) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    });

    // Mock token response
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

    const chunks: string[] = [];
    let doneReceived = false;

    for await (const chunk of chatStream(messages, { baseURL: mockBaseURL })) {
      if (chunk.type === 'chunk') {
        chunks.push(chunk.content);
      } else if (chunk.type === 'done') {
        doneReceived = true;
      }
    }

    expect(chunks).toEqual(['Hello', ' world']);
    expect(doneReceived).toBe(true);

    // Verify fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First call for token
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/tokens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );

    // Second call for streaming
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });

  it('should handle streaming errors', async () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    // Mock token response and error response
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-token' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

    await expect(async () => {
      const chunks = [];
      for await (const chunk of chatStream(messages, {
        baseURL: mockBaseURL,
      })) {
        chunks.push(chunk);
      }
    }).rejects.toThrow('HTTP error! status: 500');
  });

  it('should parse SSE events correctly with incomplete chunks', async () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    // Simulate incomplete chunks that need buffering
    const mockSSEData = [
      'event: st',
      'art\ndata: {"type":"start"}\n\n',
      'event: chunk\ndata: {"con',
      'tent":"Hello"}\n\n',
      'event: done\ndata: {"usage":{"total_tokens":5}}\n\n',
    ];

    const mockStream = new ReadableStream({
      async start(controller) {
        for (const chunk of mockSSEData) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      });

    const chunks: string[] = [];

    for await (const chunk of chatStream(messages, { baseURL: mockBaseURL })) {
      if (chunk.type === 'chunk') {
        chunks.push(chunk.content);
      }
    }

    expect(chunks).toEqual(['Hello']);
  });
});
