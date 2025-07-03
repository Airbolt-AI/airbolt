import { describe, it, expect, beforeEach, vi } from 'vitest';
import { build } from '../../helper.js';
import type { FastifyInstance } from 'fastify';

describe('Chat Route Integration Tests', () => {
  let app: FastifyInstance;
  let validToken: string;

  beforeEach(async () => {
    // Mock OpenAI API calls for integration tests
    vi.stubEnv('OPENAI_API_KEY', 'sk-test123456789012345678901234567890');
    vi.stubEnv('JWT_SECRET', 'test-secret-key-for-integration-tests-32');
    vi.stubEnv('NODE_ENV', 'test');

    app = await build();

    // Generate valid token using the app's JWT instance
    validToken = app.jwt.sign({});
  });

  describe('Full Auth + Chat Flow', () => {
    it('should complete full authenticated chat flow with mock OpenAI', async () => {
      // Mock the OpenAI service response
      const mockResponse = {
        content: 'Hello! This is a test response from the AI assistant.',
        usage: { total_tokens: 42 },
      };

      // Mock the createChatCompletion method
      vi.spyOn(app.openai, 'createChatCompletion').mockResolvedValue(
        mockResponse
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${validToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [
            { role: 'user', content: 'Hello, how are you today?' },
            {
              role: 'assistant',
              content: 'I am doing well, thank you for asking!',
            },
            { role: 'user', content: 'Can you help me with a question?' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);

      const responseBody = JSON.parse(response.payload);
      expect(responseBody).toEqual(mockResponse);

      // Verify the OpenAI service was called with correct messages
      expect(app.openai.createChatCompletion).toHaveBeenCalledWith([
        { role: 'user', content: 'Hello, how are you today?' },
        {
          role: 'assistant',
          content: 'I am doing well, thank you for asking!',
        },
        { role: 'user', content: 'Can you help me with a question?' },
      ]);
    });

    it.skip('should handle system prompt override in full flow', async () => {
      const mockResponse = {
        content: 'I am now acting as a creative writing assistant.',
        usage: { total_tokens: 35 },
      };

      // Mock OpenAI service creation and response
      const { OpenAIService } = await import('../../../src/services/openai.js');
      const mockOpenAIInstance = {
        createChatCompletion: vi.fn().mockResolvedValue(mockResponse),
      };

      // TODO: Fix mock implementation for integration tests
      // vi.mocked(OpenAIService).mockImplementation(() => mockOpenAIInstance as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${validToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Write a short poem' }],
          system: 'You are a creative writing assistant specialized in poetry.',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockResponse);

      // Verify new OpenAI service was created with system prompt
      expect(OpenAIService).toHaveBeenCalledWith(
        'sk-test123456789012345678901234567890',
        'You are a creative writing assistant specialized in poetry.'
      );

      expect(mockOpenAIInstance.createChatCompletion).toHaveBeenCalledWith([
        { role: 'user', content: 'Write a short poem' },
      ]);
    });

    it.skip('should handle rate limiting scenarios', async () => {
      // Test multiple rapid requests to trigger rate limiting
      const requests = Array.from({ length: 5 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
            'content-type': 'application/json',
          },
          payload: {
            messages: [{ role: 'user', content: `Test message ${i}` }],
          },
        })
      );

      const responses = await Promise.all(requests);

      // At least some requests should succeed (depending on rate limit config)
      const successfulResponses = responses.filter(r => r.statusCode === 200);
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);

      // Verify we get appropriate responses
      expect(successfulResponses.length + rateLimitedResponses.length).toBe(5);

      // Check rate limited responses have correct format
      rateLimitedResponses.forEach(response => {
        const body = JSON.parse(response.payload);
        expect(body).toMatchObject({
          error: expect.any(String),
          message: expect.stringContaining('rate'),
          statusCode: 429,
        });
      });
    });

    it.skip('should validate JWT token expiration', async () => {
      // Create an expired token
      const expiredToken = app.jwt.sign({}, { expiresIn: '0s' });

      // Wait a moment to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${expiredToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'This should fail' }],
        },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        statusCode: 401,
      });
    });

    it.skip('should handle CORS preflight requests correctly', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/chat',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization, content-type',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:5173'
      );
      expect(response.headers['access-control-allow-methods']).toContain(
        'POST'
      );
      expect(response.headers['access-control-allow-headers']).toContain(
        'authorization'
      );
    });

    it('should maintain conversation context across multiple exchanges', async () => {
      const mockResponses = [
        { content: 'Nice to meet you!', usage: { total_tokens: 20 } },
        {
          content: 'I can help with programming questions.',
          usage: { total_tokens: 25 },
        },
        {
          content: 'Here is a simple Python function...',
          usage: { total_tokens: 30 },
        },
      ];

      // Mock responses for each call
      const mockSpy = vi.spyOn(app.openai, 'createChatCompletion');
      mockSpy.mockResolvedValueOnce(mockResponses[0]!);
      mockSpy.mockResolvedValueOnce(mockResponses[1]!);
      mockSpy.mockResolvedValueOnce(mockResponses[2]!);

      // First exchange
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello, I am John' }],
        },
      });

      expect(response1.statusCode).toBe(200);
      expect(JSON.parse(response1.payload)).toEqual(mockResponses[0]);

      // Second exchange with context
      const response2 = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        payload: {
          messages: [
            { role: 'user', content: 'Hello, I am John' },
            { role: 'assistant', content: 'Nice to meet you!' },
            { role: 'user', content: 'What can you help me with?' },
          ],
        },
      });

      expect(response2.statusCode).toBe(200);
      expect(JSON.parse(response2.payload)).toEqual(mockResponses[1]);

      // Third exchange with full context
      const response3 = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        payload: {
          messages: [
            { role: 'user', content: 'Hello, I am John' },
            { role: 'assistant', content: 'Nice to meet you!' },
            { role: 'user', content: 'What can you help me with?' },
            {
              role: 'assistant',
              content: 'I can help with programming questions.',
            },
            { role: 'user', content: 'Can you write a Python function?' },
          ],
        },
      });

      expect(response3.statusCode).toBe(200);
      expect(JSON.parse(response3.payload)).toEqual(mockResponses[2]);

      // Verify all OpenAI calls received the correct conversation context
      expect(app.openai.createChatCompletion).toHaveBeenNthCalledWith(1, [
        { role: 'user', content: 'Hello, I am John' },
      ]);

      expect(app.openai.createChatCompletion).toHaveBeenNthCalledWith(2, [
        { role: 'user', content: 'Hello, I am John' },
        { role: 'assistant', content: 'Nice to meet you!' },
        { role: 'user', content: 'What can you help me with?' },
      ]);

      expect(app.openai.createChatCompletion).toHaveBeenNthCalledWith(3, [
        { role: 'user', content: 'Hello, I am John' },
        { role: 'assistant', content: 'Nice to meet you!' },
        { role: 'user', content: 'What can you help me with?' },
        {
          role: 'assistant',
          content: 'I can help with programming questions.',
        },
        { role: 'user', content: 'Can you write a Python function?' },
      ]);
    });

    it('should handle edge case with maximum message limit', async () => {
      const maxMessages = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `Message ${i + 1}`,
      }));

      const mockResponse = {
        content: 'Handled maximum messages successfully.',
        usage: { total_tokens: 500 },
      };

      vi.spyOn(app.openai, 'createChatCompletion').mockResolvedValue(
        mockResponse
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
        payload: {
          messages: maxMessages,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockResponse);
      expect(app.openai.createChatCompletion).toHaveBeenCalledWith(maxMessages);
    });

    it('should properly handle content-type validation', async () => {
      const mockResponse = {
        content: 'Response with proper content type.',
        usage: { total_tokens: 25 },
      };

      vi.spyOn(app.openai, 'createChatCompletion').mockResolvedValue(
        mockResponse
      );

      // Test with correct content-type
      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          authorization: `Bearer ${validToken}`,
          'content-type': 'application/json',
        },
        payload: {
          messages: [{ role: 'user', content: 'Test content type' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockResponse);
    });
  });
});
