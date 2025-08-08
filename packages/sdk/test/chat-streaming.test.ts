import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatStream } from '../src/api/chat.js';
import type { Message } from '../src/api/types.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('chatStream', () => {
  const mockMessages: Message[] = [{ role: 'user', content: 'Hello' }];

  beforeEach(() => {
    vi.clearAllMocks();
    // Always mock token endpoint first with complete response
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: 'test-token',
        expiresIn: '1h',
        tokenType: 'Bearer',
      }),
    } as any);
  });

  it('should stream chat responses', async () => {
    // Mock SSE response
    const mockResponse = {
      ok: true,
      headers: new Headers(),
      body: new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode('event: chunk\ndata: {"content":"Hello "}\n\n')
          );
          controller.enqueue(
            encoder.encode('event: chunk\ndata: {"content":"world!"}\n\n')
          );
          controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
          controller.close();
        },
      }),
    };

    vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

    const chunks: string[] = [];
    for await (const event of chatStream(mockMessages)) {
      if (event.type === 'chunk') {
        chunks.push(event.content);
      }
    }

    expect(chunks.join('')).toBe('Hello world!');
  });

  it('should handle server errors', async () => {
    // According to TESTING.md: Test behavior, not implementation
    // We care that it fails appropriately, not the exact error message

    // Mock a proper error response
    const errorStream = new ReadableStream({
      start(controller) {
        controller.close(); // Empty stream
      },
    });

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server Error',
      body: errorStream,
      headers: new Headers(),
    } as any);

    // Test behavior: streaming should fail on server error
    await expect(async () => {
      const events = [];
      for await (const event of chatStream(mockMessages)) {
        events.push(event);
      }
    }).rejects.toThrow(); // Don't test specific error message
  });
});
