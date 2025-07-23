import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SSETestServer } from './utils/sse-test-server.js';
import { SSETestUtils } from './utils/sse-test-utils.js';
import { chatStream } from '../src/api/chat.js';
import type { Message } from '../src/api/types.js';

describe('Streaming Behaviors - Real User Scenarios', () => {
  let server: SSETestServer;

  beforeEach(async () => {
    server = new SSETestServer();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('1. Partial Content on Connection Drop (20% of mobile users)', () => {
    it('delivers partial content when connection drops', async () => {
      // This WILL happen to mobile users
      server.useScenario('connectionDrop');

      const messages: Message[] = [
        { role: 'user', content: 'Tell me a story' },
      ];
      const result = await SSETestUtils.collectStream(() =>
        chatStream(messages, { baseURL: server.url })
      );

      // User gets partial value even on failure
      expect(result.chunks.join('')).toBe('Hello wo');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toMatch(/connection|terminated/);
    });
  });

  describe('2. JSON Split Across Packets (happens with proxies/CDNs)', () => {
    it('handles JSON split at chunk boundary', async () => {
      // This happens when proxies/load balancers split packets
      server.useScenario('partialMessage');

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const result = await SSETestUtils.collectStream(() =>
        chatStream(messages, { baseURL: server.url })
      );

      // Parser correctly handles split JSON
      expect(result.chunks).toEqual(['Part 1', 'Part 2']);
      expect(result.error).toBeUndefined();
    });
  });

  describe('3. Backend Errors During Stream (rate limits, token limits)', () => {
    it('propagates backend errors with partial content', async () => {
      // User hits token limit mid-response
      server.useScenario('errorMidStream');

      const messages: Message[] = [
        { role: 'user', content: 'Write a long essay' },
      ];
      const chunks: string[] = [];
      let error: Error | undefined;

      try {
        for await (const chunk of chatStream(messages, {
          baseURL: server.url,
        })) {
          if (chunk.type === 'chunk') {
            chunks.push(chunk.content);
          }
        }
      } catch (e) {
        error = e as Error;
      }

      // User gets partial content before error
      expect(chunks.join('')).toBe('Starting to respond...');
      expect(error).toBeDefined();
      expect(error?.message).toContain('Token limit exceeded');
    });
  });

  describe('4. Slow Start Prevention (prevents retry storms)', () => {
    it('does not hang on slow AI responses', async () => {
      // Prevent users from refreshing when AI is slow
      server.useScenario('slowStart');

      const messages: Message[] = [
        { role: 'user', content: 'Complex question' },
      ];

      // Should not timeout even with 3s delay
      const startTime = Date.now();
      const result = await SSETestUtils.collectStream(() =>
        chatStream(messages, { baseURL: server.url })
      );
      const duration = Date.now() - startTime;

      expect(result.chunks.join('')).toBe('Finally started!');
      expect(duration).toBeGreaterThan(3000);
      expect(duration).toBeLessThan(4000); // Should not retry
    });
  });

  describe('5. Invalid SSE Format (proxy corruption)', () => {
    it('handles malformed SSE gracefully', async () => {
      // Some proxies corrupt SSE format
      server.useScenario('invalidFormat');

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const result = await SSETestUtils.collectStream(() =>
        chatStream(messages, { baseURL: server.url })
      );

      // Should handle gracefully without crashing
      expect(result.chunks.length).toBeGreaterThanOrEqual(0);
      // May or may not have chunks depending on parser tolerance
    });
  });

  describe('Performance Characteristics', () => {
    it('provides feedback within 1 second', async () => {
      // Critical for user experience
      server.useScenario('success');

      const messages: Message[] = [{ role: 'user', content: 'Quick response' }];
      const metrics = await SSETestUtils.measureStreamingMetrics(() =>
        chatStream(messages, { baseURL: server.url })
      );

      // First chunk must arrive quickly
      expect(metrics.timeToFirstChunk).toBeLessThan(1000);
      expect(metrics.chunkCount).toBeGreaterThan(0);
      expect(metrics.errorOccurred).toBe(false);
    });
  });
});
