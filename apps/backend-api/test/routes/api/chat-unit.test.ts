import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import chatRoutes from '../../../src/routes/api/chat.js';
import { AIProviderError } from '../../../src/services/ai-provider.js';

// Mock the AI Provider service
const mockAIProviderService = {
  createChatCompletion: vi.fn(),
};

// Mock the AI Provider service module
vi.mock('../../../src/services/ai-provider.js', async () => {
  const actual = await vi.importActual('../../../src/services/ai-provider.js');
  return {
    ...actual,
    AIProviderService: vi.fn().mockImplementation(() => mockAIProviderService),
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
      AI_PROVIDER: 'openai' as const,
      OPENAI_API_KEY: 'sk-test123',
      JWT_SECRET: 'test-secret-key-for-unit-tests-32chars',
      ALLOWED_ORIGIN: ['http://localhost:3000'],
      SYSTEM_PROMPT: '',
      RATE_LIMIT_MAX: 60,
      RATE_LIMIT_TIME_WINDOW: 60000,
      TRUST_PROXY: false,
      TOKEN_LIMIT_MAX: 100000,
      TOKEN_LIMIT_TIME_WINDOW: 3600000,
      REQUEST_LIMIT_MAX: 100,
      REQUEST_LIMIT_TIME_WINDOW: 3600000,
    });

    // Mock AI Provider service
    app.decorate('aiProvider', mockAIProviderService as any);

    // Mock user rate limit functions
    app.decorate('checkUserRateLimit', async () => {});
    app.decorate('consumeTokens', async () => {});
    app.decorate('getUserUsage', async () => ({
      tokens: {
        used: 1000,
        remaining: 99000,
        limit: 100000,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
      },
      requests: {
        used: 10,
        remaining: 90,
        limit: 100,
        resetAt: new Date(Date.now() + 3600000).toISOString(),
      },
    }));
    (app as any).decorate('userRateLimiters', { request: {}, token: {} });

    // Register chat routes
    await app.register(chatRoutes, { prefix: '/api' });

    await app.ready();

    // Generate valid token for tests
    validToken = app.jwt.sign({
      userId: 'test-user-123',
      role: 'user',
    });
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
          message:
            'Missing authorization token. Include "Authorization: Bearer <token>" header',
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
          message:
            'Missing authorization token. Include "Authorization: Bearer <token>" header',
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
          message:
            'Invalid authorization token. For anonymous access, get a token from /api/tokens',
          statusCode: 401,
        });
      });

      it('should accept requests with valid JWT token', async () => {
        mockAIProviderService.createChatCompletion.mockResolvedValue({
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
        expect(mockAIProviderService.createChatCompletion).toHaveBeenCalledWith(
          [{ role: 'user', content: 'Hello' }],
          undefined,
          undefined,
          undefined
        );
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

      it('should reject messages with empty content', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: '' }],
          },
        });

        expect(response.statusCode).toBe(400);
        const responseBody = JSON.parse(response.payload);
        expect(responseBody.error).toBe('ValidationError');
        expect(responseBody.message).toContain(
          'Message content cannot be empty or contain only whitespace'
        );
      });

      it('should reject messages with whitespace-only content', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: '   \n\t  ' }],
          },
        });

        expect(response.statusCode).toBe(400);
        const responseBody = JSON.parse(response.payload);
        expect(responseBody.error).toBe('ValidationError');
        expect(responseBody.message).toContain(
          'Message content cannot be empty or contain only whitespace'
        );
      });

      it('should accept messages with content that has leading/trailing whitespace', async () => {
        mockAIProviderService.createChatCompletion.mockResolvedValue({
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
            messages: [{ role: 'user', content: '  Hello world  ' }],
          },
        });

        expect(response.statusCode).toBe(200);
        // The service should receive trimmed content
        expect(mockAIProviderService.createChatCompletion).toHaveBeenCalledWith(
          [{ role: 'user', content: 'Hello world' }],
          undefined,
          undefined,
          undefined
        );
      });

      it('should accept valid messages', async () => {
        mockAIProviderService.createChatCompletion.mockResolvedValue({
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
        expect(mockAIProviderService.createChatCompletion).toHaveBeenCalledWith(
          [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'How are you?' },
          ],
          undefined,
          undefined,
          undefined
        );
      });

      it('should accept optional system prompt', async () => {
        mockAIProviderService.createChatCompletion.mockResolvedValue({
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
        expect(mockAIProviderService.createChatCompletion).toHaveBeenCalledWith(
          [{ role: 'user', content: 'Hello' }],
          'You are a helpful assistant.',
          undefined,
          undefined
        );
      });

      it('should accept optional provider and model overrides', async () => {
        mockAIProviderService.createChatCompletion.mockResolvedValue({
          content: 'Response from Anthropic',
          usage: { total_tokens: 15 },
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
          },
        });

        expect(response.statusCode).toBe(200);
        expect(mockAIProviderService.createChatCompletion).toHaveBeenCalledWith(
          [{ role: 'user', content: 'Hello' }],
          undefined,
          'anthropic',
          'claude-3-5-sonnet-20241022'
        );
      });

      it('should accept all optional parameters together', async () => {
        mockAIProviderService.createChatCompletion.mockResolvedValue({
          content: 'Response with all options',
          usage: { total_tokens: 20 },
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            authorization: `Bearer ${validToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
            system: 'You are a creative assistant.',
            provider: 'openai',
            model: 'gpt-4',
          },
        });

        expect(response.statusCode).toBe(200);
        expect(mockAIProviderService.createChatCompletion).toHaveBeenCalledWith(
          [{ role: 'user', content: 'Hello' }],
          'You are a creative assistant.',
          'openai',
          'gpt-4'
        );
      });
    });

    describe('OpenAI Integration', () => {
      it('should return successful response from OpenAI', async () => {
        const mockResponse = {
          content: 'Hello! How can I help you today?',
          usage: { total_tokens: 25 },
        };

        mockAIProviderService.createChatCompletion.mockResolvedValue(
          mockResponse
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

        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.payload);
        expect(responseBody.content).toEqual(mockResponse.content);
        expect(responseBody.usage.total_tokens).toEqual(
          mockResponse.usage.total_tokens
        );
        expect(responseBody.usage.tokens).toBeDefined();
        expect(responseBody.usage.requests).toBeDefined();
      });

      it('should handle OpenAI rate limit errors', async () => {
        const rateLimitError = new AIProviderError(
          'Rate limit exceeded',
          429,
          'RATE_LIMIT_EXCEEDED'
        );

        mockAIProviderService.createChatCompletion.mockRejectedValue(
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

      it('should handle AI provider API key errors', async () => {
        const authError = new AIProviderError(
          'Invalid API key',
          401,
          'INVALID_API_KEY'
        );

        mockAIProviderService.createChatCompletion.mockRejectedValue(authError);

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

      it('should handle AI provider service unavailable errors', async () => {
        const serviceError = new AIProviderError(
          'Service temporarily unavailable',
          503,
          'SERVICE_UNAVAILABLE'
        );

        mockAIProviderService.createChatCompletion.mockRejectedValue(
          serviceError
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

        expect(response.statusCode).toBe(503);
        expect(JSON.parse(response.payload)).toEqual({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable',
          statusCode: 503,
        });
      });

      it('should handle unexpected errors', async () => {
        const unexpectedError = new Error('Something went wrong');

        mockAIProviderService.createChatCompletion.mockRejectedValue(
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

        mockAIProviderService.createChatCompletion.mockResolvedValue(
          mockResponse
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

        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.payload);
        expect(responseBody.content).toEqual(
          'Hello! How can I help you today?'
        );
        // Usage info is always added from the getUserUsage mock
        expect(responseBody.usage).toBeDefined();
        expect(responseBody.usage.tokens).toBeDefined();
        expect(responseBody.usage.requests).toBeDefined();
      });

      it('should return response with usage when provided by OpenAI', async () => {
        const mockResponse = {
          content: 'Hello! How can I help you today?',
          usage: { total_tokens: 25 },
        };

        mockAIProviderService.createChatCompletion.mockResolvedValue(
          mockResponse
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

        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.payload);
        expect(responseBody.content).toEqual(mockResponse.content);
        expect(responseBody.usage.total_tokens).toEqual(
          mockResponse.usage.total_tokens
        );
        expect(responseBody.usage.tokens).toBeDefined();
        expect(responseBody.usage.requests).toBeDefined();
      });
    });
  });
});
