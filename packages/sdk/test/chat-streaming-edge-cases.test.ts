import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SSETestServer } from './utils/sse-test-server.js';
import { SSEScenarioBuilder, SSETestUtils } from './utils/sse-test-utils.js';
import { chatStream } from '../src/api/chat.js';
import type { Message } from '../src/api/types.js';

describe('Streaming Edge Cases - Parser Robustness', () => {
  let server: SSETestServer;

  beforeEach(async () => {
    server = new SSETestServer();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('JSON Split at Every Position', () => {
    it('handles JSON split at any byte boundary', async () => {
      // Test splitting at different positions
      const testData = { content: 'Hello World!' };
      const json = JSON.stringify(testData);

      // Test splits at critical positions
      const criticalSplits = [
        1, // After {
        10, // In middle of "content"
        20, // In middle of value
        json.length - 1, // Before }
      ];

      for (const splitAt of criticalSplits) {
        const scenario = new SSEScenarioBuilder(`split-at-${splitAt}`)
          .addEvent('start', { type: 'start' })
          .addRaw('event: chunk\n')
          .splitJSON(testData, splitAt)
          .addEvent('done', {})
          .build();

        server.setCustomScenario(scenario);

        const messages: Message[] = [{ role: 'user', content: 'Test' }];
        const result = await SSETestUtils.collectStream(() =>
          chatStream(messages, { baseURL: server.url })
        );

        expect(result.chunks).toEqual(['Hello World!']);
        expect(result.error).toBeUndefined();
      }
    });
  });

  describe('Ultra-Fragmented Streams', () => {
    it('handles 1-byte chunks without memory explosion', async () => {
      // Worst case: every byte comes separately
      const content = 'This is a test of ultra fragmented streaming';
      const scenario = new SSEScenarioBuilder('ultra-fragmented').addEvent(
        'start',
        { type: 'start' }
      );

      // Send each character as a separate chunk
      for (const char of content) {
        scenario.addChunk(char, { delayMs: 1 });
      }

      scenario.addEvent('done', {});
      server.setCustomScenario(scenario.build());

      const messages: Message[] = [{ role: 'user', content: 'Fragment test' }];
      const result = await SSETestUtils.collectStream(() =>
        chatStream(messages, { baseURL: server.url })
      );

      expect(result.chunks.join('')).toBe(content);
      expect(result.chunks.length).toBe(content.length);
    });
  });

  describe('Mixed Valid/Invalid Events', () => {
    it('continues after encountering invalid events', async () => {
      const scenario = new SSEScenarioBuilder('mixed-validity')
        .addEvent('start', { type: 'start' })
        .addEvent('chunk', { content: 'Valid 1' })
        .addRaw('event: chunk\ndata: {invalid json\n\n') // Invalid JSON
        .addEvent('chunk', { content: 'Valid 2' })
        .addRaw('event: unknown\ndata: {"foo": "bar"}\n\n') // Unknown event
        .addEvent('chunk', { content: 'Valid 3' })
        .addEvent('done', {})
        .build();

      server.setCustomScenario(scenario);

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const result = await SSETestUtils.collectStream(() =>
        chatStream(messages, { baseURL: server.url })
      );

      // Should get all valid chunks, skip invalid ones
      expect(result.chunks).toEqual(['Valid 1', 'Valid 2', 'Valid 3']);
    });
  });

  describe('Empty and Whitespace Handling', () => {
    it('handles chunks with only whitespace', async () => {
      const scenario = new SSEScenarioBuilder('whitespace')
        .addEvent('start', { type: 'start' })
        .addEvent('chunk', { content: 'Start' })
        .addEvent('chunk', { content: '' }) // Empty
        .addEvent('chunk', { content: '   ' }) // Spaces
        .addEvent('chunk', { content: '\n\t' }) // Newlines and tabs
        .addEvent('chunk', { content: 'End' })
        .addEvent('done', {})
        .build();

      server.setCustomScenario(scenario);

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const result = await SSETestUtils.collectStream(() =>
        chatStream(messages, { baseURL: server.url })
      );

      // Empty chunks should be preserved
      expect(result.chunks).toEqual(['Start', '', '   ', '\n\t', 'End']);
    });
  });

  describe('Network Timing Edge Cases', () => {
    it('handles data arriving in bursts', async () => {
      // Simulate buffering where data arrives in bursts
      const scenario = new SSEScenarioBuilder('bursty')
        .addEvent('start', { type: 'start' })
        .addDelay(1000) // Long pause
        .addEvent('chunk', { content: 'Burst 1-1' })
        .addEvent('chunk', { content: 'Burst 1-2' })
        .addEvent('chunk', { content: 'Burst 1-3' })
        .addDelay(1000) // Another pause
        .addEvent('chunk', { content: 'Burst 2-1' })
        .addEvent('chunk', { content: 'Burst 2-2' })
        .addEvent('done', {})
        .build();

      server.setCustomScenario(scenario);

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const startTime = Date.now();
      const result = await SSETestUtils.collectStream(() =>
        chatStream(messages, { baseURL: server.url })
      );
      const duration = Date.now() - startTime;

      expect(result.chunks).toEqual([
        'Burst 1-1',
        'Burst 1-2',
        'Burst 1-3',
        'Burst 2-1',
        'Burst 2-2',
      ]);
      expect(duration).toBeGreaterThan(2000); // Should handle delays
    });
  });

  describe('Special Characters in Content', () => {
    it('handles newlines and special characters in chunks', async () => {
      const specialContent = [
        'Line 1\nLine 2', // Newlines
        'Tab\there', // Tabs
        '{"json": "in content"}', // JSON-like content
        'Emoji: 🚀 🎉', // Unicode
        'Quotes: "double" \'single\'', // Quotes
        'Escape: \\n \\t \\r', // Escape sequences
      ];

      const scenario = new SSEScenarioBuilder('special-chars').addEvent(
        'start',
        { type: 'start' }
      );

      for (const content of specialContent) {
        scenario.addEvent('chunk', { content });
      }

      scenario.addEvent('done', {});
      server.setCustomScenario(scenario.build());

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const result = await SSETestUtils.collectStream(() =>
        chatStream(messages, { baseURL: server.url })
      );

      // All special characters should be preserved
      expect(result.chunks).toEqual(specialContent);
    });
  });
});
