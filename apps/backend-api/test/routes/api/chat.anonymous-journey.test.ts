import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { build } from '../../helper.js';
import type { FastifyInstance } from 'fastify';
import type { AIProviderService } from '../../../src/services/ai-provider.js';

describe('Anonymous Chat User Journey', () => {
  let app: FastifyInstance;
  let mockAIProviderService: Partial<AIProviderService>;

  beforeEach(async () => {
    vi.resetAllMocks();

    // Mock AI Provider responses
    mockAIProviderService = {
      createChatCompletion: vi.fn().mockResolvedValue({
        content: 'Hello! How can I help you today?',
        usage: { total_tokens: 20 },
      }),
    };

    // Build app in anonymous mode (development for localhost testing)
    app = await build({
      NODE_ENV: 'development',
      // Explicitly disable external auth
      EXTERNAL_JWT_ISSUER: '',
      EXTERNAL_JWT_PUBLIC_KEY: '',
      EXTERNAL_JWT_SECRET: '',
      // Explicitly set ALLOWED_ORIGIN to include test origins
      ALLOWED_ORIGIN: 'http://localhost:3001',
    });

    await app.ready();

    // Mock the AI Provider service
    if (app.aiProvider) {
      vi.spyOn(app.aiProvider, 'createChatCompletion').mockImplementation(
        mockAIProviderService.createChatCompletion as any
      );
    }
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('should allow chat with minimal setup (get token then chat)', async () => {
    // Step 1: Get an anonymous token
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      headers: {
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(tokenResponse.statusCode).toBe(201);
    const { token } = JSON.parse(tokenResponse.payload);
    expect(typeof token).toBe('string');

    // Step 2: Use the token to chat
    const chatResponse = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      payload: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    expect(chatResponse.statusCode).toBe(200);
    expect(chatResponse.headers['x-byoa-mode']).toBe('auto');

    const body = JSON.parse(chatResponse.payload);
    expect(body.content).toBe('Hello! How can I help you today?');
    expect(body.usage).toBeDefined();
  });

  it('should maintain conversation across multiple messages', async () => {
    // Get token first
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      payload: {},
    });
    const { token } = JSON.parse(tokenResponse.payload);

    const mockResponses = [
      { content: 'Hi! I can help you with that.', usage: { total_tokens: 15 } },
      {
        content: 'Based on what you said earlier...',
        usage: { total_tokens: 25 },
      },
      {
        content: 'To summarize our conversation...',
        usage: { total_tokens: 30 },
      },
    ];

    let callCount = 0;
    mockAIProviderService.createChatCompletion = vi
      .fn()
      .mockImplementation(async () => {
        return (
          mockResponses[callCount++] || mockResponses[mockResponses.length - 1]
        );
      });

    if (app.aiProvider) {
      vi.spyOn(app.aiProvider, 'createChatCompletion').mockImplementation(
        mockAIProviderService.createChatCompletion as any
      );
    }

    // First message
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      payload: {
        messages: [{ role: 'user', content: 'I need help with my code' }],
      },
    });

    expect(response1.statusCode).toBe(200);
    expect(JSON.parse(response1.payload).content).toBe(
      'Hi! I can help you with that.'
    );

    // Follow-up with context
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      payload: {
        messages: [
          { role: 'user', content: 'I need help with my code' },
          { role: 'assistant', content: 'Hi! I can help you with that.' },
          { role: 'user', content: "It's about authentication" },
        ],
      },
    });

    expect(response2.statusCode).toBe(200);
    expect(JSON.parse(response2.payload).content).toBe(
      'Based on what you said earlier...'
    );

    // Summary request
    const response3 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      payload: {
        messages: [
          { role: 'user', content: 'I need help with my code' },
          { role: 'assistant', content: 'Hi! I can help you with that.' },
          { role: 'user', content: "It's about authentication" },
          { role: 'assistant', content: 'Based on what you said earlier...' },
          { role: 'user', content: 'Can you summarize?' },
        ],
      },
    });

    expect(response3.statusCode).toBe(200);
    expect(JSON.parse(response3.payload).content).toBe(
      'To summarize our conversation...'
    );
  });

  it('should include rate limit headers in responses', async () => {
    // Get token first
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      payload: {},
    });
    const { token } = JSON.parse(tokenResponse.payload);

    // Make a request and verify rate limit headers exist
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      payload: { messages: [{ role: 'user', content: 'Test message' }] },
    });

    expect(response.statusCode).toBe(200);

    // Verify rate limit headers are present
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();

    // Verify they have reasonable values
    const limit = parseInt(response.headers['x-ratelimit-limit'] as string);
    const remaining = parseInt(
      response.headers['x-ratelimit-remaining'] as string
    );
    expect(limit).toBeGreaterThan(0);
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThan(limit);
  });

  it('should validate message format without authentication', async () => {
    // Missing messages array
    const response1 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    expect(response1.statusCode).toBe(400);

    // Invalid message role
    const response2 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'application/json' },
      payload: {
        messages: [{ role: 'invalid', content: 'Hello' }],
      },
    });
    expect(response2.statusCode).toBe(400);

    // Empty messages array
    const response3 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'application/json' },
      payload: {
        messages: [],
      },
    });
    expect(response3.statusCode).toBe(400);
  });

  it('should handle AI provider errors gracefully', async () => {
    // Get token first
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      payload: {},
    });
    const { token } = JSON.parse(tokenResponse.payload);

    // Mock AI provider error
    mockAIProviderService.createChatCompletion = vi
      .fn()
      .mockRejectedValue(new Error('OpenAI service unavailable'));

    if (app.aiProvider) {
      vi.spyOn(app.aiProvider, 'createChatCompletion').mockImplementation(
        mockAIProviderService.createChatCompletion as any
      );
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      payload: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.error).toContain('InternalServerError');
  });

  it('should include proper CORS headers for browser clients', async () => {
    // Get token first
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      payload: {},
    });
    const { token } = JSON.parse(tokenResponse.payload);

    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        origin: 'http://localhost:3001',
      },
      payload: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    // If response is 500, log the error for debugging
    if (response.statusCode === 500) {
      console.error('500 error response:', response.payload);
    }

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3001'
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});
