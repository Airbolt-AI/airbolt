import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestEnv } from '@airbolt/test-utils';
import { chatStream } from '@airbolt/sdk';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Streaming E2E', () => {
  let app: FastifyInstance;
  let baseURL: string;

  beforeAll(async () => {
    createTestEnv({
      OPENAI_API_KEY: 'sk-proj-' + 'a'.repeat(48),
      JWT_SECRET: 'test-secret-key-for-jwt-that-is-long-enough',
    });

    app = await buildApp({ logger: false });
    await app.listen({ port: 0, host: '127.0.0.1' });

    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    baseURL = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('streams chat responses end-to-end', async () => {
    // Mock the AI provider to return a stream
    vi.spyOn(app.aiProvider, 'createChatCompletionStream').mockResolvedValue(
      (async function* () {
        yield 'Hello';
        yield ' from';
        yield ' streaming!';
      })()
    );

    // Use real SDK to connect to real backend
    const chunks: string[] = [];
    for await (const event of chatStream([{ role: 'user', content: 'Hello' }], {
      baseURL,
    })) {
      if (event.type === 'chunk') {
        chunks.push(event.content);
      }
    }

    expect(chunks.join('')).toBe('Hello from streaming!');
  });

  it('handles streaming errors gracefully', async () => {
    // Mock provider error
    vi.spyOn(app.aiProvider, 'createChatCompletionStream').mockImplementation(
      async () => {
        async function* errorStream() {
          yield 'Started...';
          throw new Error('Provider error');
        }
        return errorStream();
      }
    );

    const chunks: string[] = [];
    let error: Error | undefined;

    try {
      for await (const event of chatStream(
        [{ role: 'user', content: 'Test' }],
        { baseURL }
      )) {
        if (event.type === 'chunk') {
          chunks.push(event.content);
        }
      }
    } catch (e) {
      error = e as Error;
    }

    expect(chunks).toEqual(['Started...']);
    expect(error).toBeDefined();
    expect(error?.message).toContain('Provider error');
  });
});
