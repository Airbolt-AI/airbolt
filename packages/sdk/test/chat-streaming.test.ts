import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatStream } from '../src/api/chat.js';
import type { Message } from '../src/api/types.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('chatStream', () => {
  const mockMessages: Message[] = [{ role: 'user', content: 'Hello' }];

  beforeEach(() => {
    vi.clearAllMocks();
    // Always mock token endpoint first
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test-token' }),
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

  it('should handle errors gracefully', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Server Error',
    } as any);

    await expect(async () => {
      for await (const _ of chatStream(mockMessages)) {
        // Should throw before yielding
      }
    }).rejects.toThrow('HTTP error! status: 500');
  });
});
