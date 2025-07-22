import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { createTestEnv } from '@airbolt/test-utils';

describe('Chat Streaming Endpoint', () => {
  let app: FastifyInstance;
  let token: string;

  beforeEach(async () => {
    createTestEnv({
      OPENAI_API_KEY: 'test-key',
      JWT_SECRET: 'test-secret-key-for-jwt-that-is-long-enough',
    });

    app = await buildApp({ logger: false });

    // Get a valid token
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      payload: { userId: 'test-user' },
    });

    const tokenData = JSON.parse(tokenResponse.payload);
    token = tokenData.token;
  });

  describe('POST /api/chat with streaming', () => {
    it('should stream response when Accept header includes text/event-stream', async () => {
      // Mock the AI provider's streaming method
      const mockStream = async function* () {
        yield 'Hello';
        yield ' streaming';
        yield ' world!';
      };

      vi.spyOn(app.aiProvider, 'createChatCompletionStream').mockResolvedValue(
        mockStream()
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');

      // Parse SSE events from the response
      const events = response.payload.split('\n\n').filter(Boolean);
      expect(events.length).toBeGreaterThan(0);

      // Verify start event
      expect(events[0]).toContain('event: start');

      // Verify chunk events
      const chunkEvents = events.filter(e => e.includes('event: chunk'));
      expect(chunkEvents.length).toBe(3);

      // Verify done event
      expect(events[events.length - 1]).toContain('event: done');
    });

    it('should handle streaming errors gracefully', async () => {
      // Mock the AI provider to throw an error
      const mockStream = async function* () {
        yield 'Start';
        throw new Error('Stream interrupted');
      };

      vi.spyOn(app.aiProvider, 'createChatCompletionStream').mockResolvedValue(
        mockStream()
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(200);

      const events = response.payload.split('\n\n').filter(Boolean);
      const errorEvent = events.find(e => e.includes('event: error'));
      expect(errorEvent).toBeDefined();
      expect(errorEvent).toContain('Stream interrupted');
    });

    it('should use non-streaming mode when Accept header is not text/event-stream', async () => {
      vi.spyOn(app.aiProvider, 'createChatCompletion').mockResolvedValue({
        content: 'Non-streaming response',
        usage: { total_tokens: 10 },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const data = JSON.parse(response.payload);
      expect(data.content).toBe('Non-streaming response');
      expect(data.usage.total_tokens).toBe(10);
    });
  });
});
