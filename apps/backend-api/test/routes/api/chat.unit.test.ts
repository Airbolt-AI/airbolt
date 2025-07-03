import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import chatRoutes from '../../../src/routes/api/chat.js';
import { OpenAIServiceError } from '../../../src/services/openai.js';

// Mock the OpenAI service
const mockOpenAIService = {
  createChatCompletion: vi.fn(),
};

// Mock the OpenAI service module
vi.mock('../../../src/services/openai.js', async () => {
  const actual = await vi.importActual('../../../src/services/openai.js');
  return {
    ...actual,
    OpenAIService: vi.fn().mockImplementation(() => mockOpenAIService),
  };
});

describe('Chat Route Unit Tests', () => {
  let app: FastifyInstance;
  let validToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    app = Fastify();

    // Register sensible plugin first for httpErrors
    await app.register(import('@fastify/sensible'));

    // Register JWT plugin with test secret
    await app.register(import('@fastify/jwt'), {
      secret: 'test-secret-key-for-unit-tests-32chars',
      sign: {
        algorithm: 'HS256',
        expiresIn: '15m',
        iss: 'airbolt-api',
      },
      verify: {
        allowedIss: 'airbolt-api',
      },
    });

    // Mock config
    app.decorate('config', {
      NODE_ENV: 'test' as const,
      PORT: 3000,
      LOG_LEVEL: 'info' as const,
      OPENAI_API_KEY: 'sk-test123',
      JWT_SECRET: 'test-secret-key-for-unit-tests-32chars',
      ALLOWED_ORIGIN: ['http://localhost:3000'],
      SYSTEM_PROMPT: '',
      RATE_LIMIT_MAX: 60,
      RATE_LIMIT_TIME_WINDOW: 60000,
      TRUST_PROXY: false,
    });

    // Mock OpenAI service
    app.decorate('openai', mockOpenAIService as any);

    // Register chat routes
    await app.register(chatRoutes, { prefix: '/api' });

    await app.ready();

    // Generate valid token for tests
    validToken = app.jwt.sign({});
  });

  describe('POST /api/chat', () => {
    describe('Authentication', () => {
      it('should reject requests without authorization header', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
          statusCode: 401,
        });
      });

      it('should reject requests with invalid authorization format', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: 'Invalid token',
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
          statusCode: 401,
        });
      });

      it('should reject requests with invalid JWT token', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: 'Bearer invalid-token',
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
          statusCode: 401,
        });
      });

      it('should accept requests with valid JWT token', async () => {
        mockOpenAIService.createChatCompletion.mockResolvedValue({
          content: 'Hello! How can I help you today?',
          usage: { total_tokens: 25 },
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(200);
        expect(mockOpenAIService.createChatCompletion).toHaveBeenCalledWith([
          { role: 'user', content: 'Hello' },
        ]);
      });
    });

    describe('Request Validation', () => {
      it('should reject empty messages array', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [],
          },
        });

        expect(response.statusCode).toBe(400);
        const responseBody = JSON.parse(response.payload);
        expect(responseBody.error).toBe('Bad Request');
        expect(responseBody.message).toContain(
          'must NOT have fewer than 1 items'
        );
      });

      it('should reject too many messages', async () => {
        const tooManyMessages = Array.from({ length: 51 }, (_, i) => ({
          role: 'user' as const,
          content: `Message ${i}`,
        }));

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: tooManyMessages,
          },
        });

        expect(response.statusCode).toBe(400);
        const responseBody = JSON.parse(response.payload);
        expect(responseBody.error).toBe('Bad Request');
        expect(responseBody.message).toContain(
          'must NOT have more than 50 items'
        );
      });

      it('should reject messages with invalid role', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'invalid', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(400);
        const responseBody = JSON.parse(response.payload);
        expect(responseBody.error).toBe('Bad Request');
      });

      it('should reject messages without content', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user' }],
          },
        });

        expect(response.statusCode).toBe(400);
        const responseBody = JSON.parse(response.payload);
        expect(responseBody.error).toBe('Bad Request');
      });

      it('should accept valid messages', async () => {
        mockOpenAIService.createChatCompletion.mockResolvedValue({
          content: 'Response',
          usage: { total_tokens: 10 },
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [
              { role: 'user', content: 'Hello' },
              { role: 'assistant', content: 'Hi there!' },
              { role: 'user', content: 'How are you?' },
            ],
          },
        });

        expect(response.statusCode).toBe(200);
        expect(mockOpenAIService.createChatCompletion).toHaveBeenCalledWith([
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ]);
      });

      it('should accept optional system prompt', async () => {
        mockOpenAIService.createChatCompletion.mockResolvedValue({
          content: 'Response',
          usage: { total_tokens: 10 },
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
            system: 'You are a helpful assistant.',
          },
        });

        expect(response.statusCode).toBe(200);
        // Should create new OpenAI service instance with system prompt
      });
    });

    describe('OpenAI Integration', () => {
      it('should return successful response from OpenAI', async () => {
        const mockResponse = {
          content: 'Hello! How can I help you today?',
          usage: { total_tokens: 25 },
        };

        mockOpenAIService.createChatCompletion.mockResolvedValue(mockResponse);

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual(mockResponse);
      });

      it('should handle OpenAI rate limit errors', async () => {
        const rateLimitError = new OpenAIServiceError(
          'Rate limit exceeded',
          429,
          'RATE_LIMIT_EXCEEDED'
        );

        mockOpenAIService.createChatCompletion.mockRejectedValue(
          rateLimitError
        );

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(429);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          statusCode: 429,
        });
      });

      it('should handle OpenAI API key errors', async () => {
        const authError = new OpenAIServiceError(
          'Invalid API key',
          401,
          'INVALID_API_KEY'
        );

        mockOpenAIService.createChatCompletion.mockRejectedValue(authError);

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'INVALID_API_KEY',
          message: 'Invalid API key',
          statusCode: 401,
        });
      });

      it('should handle OpenAI service unavailable errors', async () => {
        const serviceError = new OpenAIServiceError(
          'Service temporarily unavailable',
          503,
          'SERVICE_UNAVAILABLE'
        );

        mockOpenAIService.createChatCompletion.mockRejectedValue(serviceError);

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(503);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable',
          statusCode: 503,
        });
      });

      it('should handle unexpected errors', async () => {
        const unexpectedError = new Error('Something went wrong');

        mockOpenAIService.createChatCompletion.mockRejectedValue(
          unexpectedError
        );

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(500);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'InternalServerError',
          message: 'An unexpected error occurred while processing your request',
          statusCode: 500,
        });
      });
    });

    describe('Response Format', () => {
      it('should return response without usage when not provided by OpenAI', async () => {
        const mockResponse = {
          content: 'Hello! How can I help you today?',
        };

        mockOpenAIService.createChatCompletion.mockResolvedValue(mockResponse);

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.payload);
        expect(responseBody).toEqual({
          content: 'Hello! How can I help you today?',
        });
        expect(responseBody.usage).toBeUndefined();
      });

      it('should return response with usage when provided by OpenAI', async () => {
        const mockResponse = {
          content: 'Hello! How can I help you today?',
          usage: { total_tokens: 25 },
        };

        mockOpenAIService.createChatCompletion.mockResolvedValue(mockResponse);

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
          },
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual(mockResponse);
      });
    });
  });
});
