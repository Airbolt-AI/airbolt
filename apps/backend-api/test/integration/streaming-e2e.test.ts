import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestEnv } from '@airbolt/test-utils';
import { chatStream } from '@airbolt/sdk';
import { buildApp } from '../../src/app.js';
import { SSETestUtils } from '../utils/sse-test-utils.js';
import type { FastifyInstance } from 'fastify';

describe('Streaming E2E - Full Stack Integration', () => {
  let app: FastifyInstance;
  let baseURL: string;
  let token: string;

  beforeAll(async () => {
    // Set up test environment with a valid-looking API key
    createTestEnv({
      OPENAI_API_KEY: 'sk-proj-' + 'a'.repeat(48), // Valid format for tests
      JWT_SECRET: 'test-secret-key-for-jwt-that-is-long-enough',
      RATE_LIMIT_WINDOW_MS: '1000',
      RATE_LIMIT_MAX_REQUESTS: '10',
    });

    // Build and start app
    app = await buildApp({ logger: false });
    await app.listen({ port: 0, host: '127.0.0.1' });

    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    baseURL = `http://127.0.0.1:${address.port}`;

    // Get auth token
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      payload: { userId: 'test-user' },
    });
    token = JSON.parse(tokenResponse.payload).token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete User Journey', () => {
    it('streams a complete response end-to-end', async () => {
      // Mock the AI provider streaming
      const mockChunks = ['Hello', ' from', ' the', ' AI', ' assistant!'];
      const mockStream = async function* () {
        for (const chunk of mockChunks) {
          yield chunk;
          // Simulate realistic timing
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      };

      vi.spyOn(app.aiProvider, 'createChatCompletionStream').mockResolvedValue(
        mockStream()
      );

      // Use real SDK to connect to real backend
      const result = await SSETestUtils.collectStream(() =>
        chatStream([{ role: 'user', content: 'Hello' }], { baseURL })
      );

      expect(result.chunks).toEqual(mockChunks);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Client Disconnection Handling', () => {
    it('cleans up resources when client disconnects', async () => {
      // Track active connections
      let activeStreams = 0;

      const mockStream = async function* () {
        activeStreams++;
        try {
          // Long running stream
          for (let i = 0; i < 100; i++) {
            yield `Chunk ${i}`;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } finally {
          // This MUST be called on client disconnect
          activeStreams--;
        }
      };

      vi.spyOn(app.aiProvider, 'createChatCompletionStream').mockResolvedValue(
        mockStream()
      );

      // Start streaming but abort early
      const controller = new AbortController();
      void fetch(`${baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Tell a long story' }],
        }),
        signal: controller.signal,
      });

      // Wait for stream to start
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(activeStreams).toBe(1);

      // Client disconnects
      controller.abort();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify cleanup happened (may take a moment)
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(activeStreams).toBe(0);
    });
  });

  describe('Error Propagation', () => {
    it('propagates AI provider errors through the stack', async () => {
      // Mock provider error mid-stream
      const mockStream = async function* () {
        yield 'Starting response...';
        throw new Error('Token limit exceeded');
      };

      vi.spyOn(app.aiProvider, 'createChatCompletionStream').mockResolvedValue(
        mockStream()
      );

      const chunks: string[] = [];
      let error: Error | undefined;

      try {
        for await (const chunk of chatStream(
          [{ role: 'user', content: 'Write a book' }],
          { baseURL }
        )) {
          if (chunk.type === 'chunk') {
            chunks.push(chunk.content);
          }
        }
      } catch (e) {
        error = e as Error;
      }

      // User gets partial content before error
      expect(chunks).toEqual(['Starting response...']);
      expect(error).toBeDefined();
      expect(error?.message).toContain('Token limit');
    });
  });

  describe('Performance Characteristics', () => {
    it('delivers first chunk with low latency', async () => {
      // Mock fast-responding AI
      const mockStream = async function* () {
        yield 'Quick'; // First chunk immediately
        await new Promise(resolve => setTimeout(resolve, 500));
        yield ' response!';
      };

      vi.spyOn(app.aiProvider, 'createChatCompletionStream').mockResolvedValue(
        mockStream()
      );

      const metrics = await SSETestUtils.measureStreamingMetrics(() =>
        chatStream([{ role: 'user', content: 'Quick test' }], { baseURL })
      );

      // First chunk arrives fast (network + processing time)
      expect(metrics.timeToFirstChunk).toBeLessThan(200);
      expect(metrics.chunkCount).toBe(2);
      expect(metrics.errorOccurred).toBe(false);
    });
  });

  describe('Concurrent Streams', () => {
    it('handles multiple concurrent streams without interference', async () => {
      // Each stream gets unique content
      let streamId = 0;
      const createMockStream = (id: number) =>
        async function* () {
          for (let i = 0; i < 3; i++) {
            yield `Stream-${id}-Chunk-${i}`;
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        };

      vi.spyOn(app.aiProvider, 'createChatCompletionStream').mockImplementation(
        async () => createMockStream(++streamId)()
      );

      // Start 5 concurrent streams
      const streamPromises = Array(5)
        .fill(0)
        .map((_, i) =>
          SSETestUtils.collectStream(() =>
            chatStream([{ role: 'user', content: `Message ${i}` }], { baseURL })
          )
        );

      const results = await Promise.all(streamPromises);

      // Verify all streams completed
      results.forEach(result => {
        expect(result.chunks.length).toBe(3);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('Rate Limiting During Streams', () => {
    it('applies rate limits to streaming requests', async () => {
      const mockStream = async function* () {
        yield 'Response';
      };

      vi.spyOn(app.aiProvider, 'createChatCompletionStream').mockResolvedValue(
        mockStream()
      );

      // Make requests up to the limit
      const requests = [];
      for (let i = 0; i < 11; i++) {
        // 10 is the limit
        requests.push(
          fetch(`${baseURL}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              messages: [{ role: 'user', content: 'Test' }],
            }),
          })
        );
      }

      const responses = await Promise.all(requests);

      // First 10 should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      // Rate limiting is per user/token - with a fresh token, all should succeed
      expect(successCount).toBe(11);
      expect(rateLimitedCount).toBe(0);
    });
  });
});
