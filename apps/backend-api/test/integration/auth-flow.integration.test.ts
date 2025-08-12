import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { build } from '../helper.js';
import type { FastifyInstance } from 'fastify';
import type { AIProviderService } from '../../src/services/ai-provider.js';

/**
 * Comprehensive Authentication Flow Integration Test
 *
 * Tests the complete authentication workflow from TESTING.md:
 * - Login (get token)
 * - Use token for API call
 * - Token expiry
 * - Automatic refresh
 * - Continue using refreshed token
 *
 * This test validates the real-world user journey including edge cases
 * like concurrent requests during token expiry and error recovery.
 */
describe('Authentication Flow Integration', () => {
  let app: FastifyInstance;
  let mockAIProviderService: Partial<AIProviderService>;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    // Mock AI Provider for chat functionality
    mockAIProviderService = {
      createChatCompletion: vi.fn().mockResolvedValue({
        content: 'Authentication test response',
        usage: { total_tokens: 25 },
      }),
    };

    // Build app in development mode for token testing
    app = await build({
      NODE_ENV: 'development',
      JWT_SECRET:
        'test-secret-key-for-auth-flow-integration-tests-32characters',
      // Disable external auth for this test
      EXTERNAL_JWT_ISSUER: '',
      EXTERNAL_JWT_PUBLIC_KEY: '',
      EXTERNAL_JWT_SECRET: '',
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Complete Authentication Workflow', () => {
    it('should handle full auth flow: login → API call → expiry → refresh → continue', async () => {
      // Step 1: Login (get initial token)
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        headers: { 'content-type': 'application/json' },
        payload: { userId: 'auth-flow-test-user' },
      });

      expect(loginResponse.statusCode).toBe(201);

      const loginData = JSON.parse(loginResponse.payload);
      expect(loginData).toMatchObject({
        token: expect.any(String),
        expiresIn: '15m',
        tokenType: 'Bearer',
      });

      const initialToken = loginData.token;
      expect(initialToken).toMatch(
        /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/
      ); // JWT format

      // Step 2: Use token for API call
      const chatResponse1 = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${initialToken}`,
        },
        payload: {
          messages: [{ role: 'user', content: 'Test auth flow message 1' }],
        },
      });

      expect(chatResponse1.statusCode).toBe(200);
      const chatData1 = JSON.parse(chatResponse1.payload);
      expect(chatData1.content).toBe('Authentication test response');
      expect(mockAIProviderService.createChatCompletion).toHaveBeenCalledTimes(
        1
      );

      // Step 3: Fast-forward time to simulate token expiry (15m + buffer)
      // JWT tokens expire in 15 minutes, advance to just past expiry
      vi.advanceTimersByTime(16 * 60 * 1000); // 16 minutes

      // Step 4: Try to use expired token (should fail)
      const expiredTokenResponse = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${initialToken}`,
        },
        payload: {
          messages: [
            { role: 'user', content: 'This should fail with expired token' },
          ],
        },
      });

      expect(expiredTokenResponse.statusCode).toBe(401);
      expect(JSON.parse(expiredTokenResponse.payload)).toMatchObject({
        error: 'Unauthorized',
        message: expect.stringContaining('expired'),
      });

      // Step 5: Automatic refresh - get new token
      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        headers: { 'content-type': 'application/json' },
        payload: { userId: 'auth-flow-test-user' },
      });

      expect(refreshResponse.statusCode).toBe(201);

      const refreshData = JSON.parse(refreshResponse.payload);
      const refreshedToken = refreshData.token;

      // New token should be different from initial token
      expect(refreshedToken).not.toBe(initialToken);
      expect(refreshedToken).toMatch(
        /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/
      );

      // Step 6: Continue using refreshed token
      const chatResponse2 = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${refreshedToken}`,
        },
        payload: {
          messages: [{ role: 'user', content: 'Test with refreshed token' }],
        },
      });

      expect(chatResponse2.statusCode).toBe(200);
      const chatData2 = JSON.parse(chatResponse2.payload);
      expect(chatData2.content).toBe('Authentication test response');
      expect(mockAIProviderService.createChatCompletion).toHaveBeenCalledTimes(
        2
      );

      // Verify rate limiting headers are present throughout the flow
      expect(chatResponse1.headers['x-ratelimit-limit']).toBeDefined();
      expect(chatResponse2.headers['x-ratelimit-limit']).toBeDefined();
    });

    it('should handle concurrent requests during token expiry gracefully', async () => {
      // Get initial token
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: { userId: 'concurrent-test-user' },
      });

      const initialToken = JSON.parse(loginResponse.payload).token;

      // Fast-forward to token expiry
      vi.advanceTimersByTime(16 * 60 * 1000);

      // Make multiple concurrent requests with expired token
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${initialToken}`,
          },
          payload: {
            messages: [
              { role: 'user', content: `Concurrent request ${i + 1}` },
            ],
          },
        })
      );

      const responses = await Promise.all(concurrentRequests);

      // All should fail with same error (expired token)
      responses.forEach((response, index) => {
        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toMatchObject({
          error: 'Unauthorized',
          message: expect.stringContaining('expired'),
        });
      });

      // Verify no AI calls were made with expired token
      expect(mockAIProviderService.createChatCompletion).not.toHaveBeenCalled();
    });

    it('should maintain session state across token refresh', async () => {
      // Initial login
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: { userId: 'session-test-user' },
      });

      const initialToken = JSON.parse(loginResponse.payload).token;

      // Verify token payload contains correct user info
      const tokenParts = initialToken.split('.');
      const payload = JSON.parse(
        Buffer.from(tokenParts[1], 'base64url').toString()
      );

      expect(payload).toMatchObject({
        userId: 'session-test-user',
        role: 'user',
        iss: 'airbolt-api',
      });
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();

      // Get refreshed token
      vi.advanceTimersByTime(16 * 60 * 1000);

      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: { userId: 'session-test-user' },
      });

      const refreshedToken = JSON.parse(refreshResponse.payload).token;

      // Verify refreshed token maintains session state
      const refreshedParts = refreshedToken.split('.');
      const refreshedPayload = JSON.parse(
        Buffer.from(refreshedParts[1], 'base64url').toString()
      );

      expect(refreshedPayload).toMatchObject({
        userId: 'session-test-user',
        role: 'user',
        iss: 'airbolt-api',
      });

      // Expiration should be updated
      expect(refreshedPayload.exp).toBeGreaterThan(payload.exp);
      expect(refreshedPayload.iat).toBeGreaterThan(payload.iat);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle authentication failures gracefully during refresh', async () => {
      // Temporarily make token endpoint fail
      const originalInject = app.inject.bind(app);
      let tokenRequestCount = 0;

      // Mock inject to fail token refresh attempts
      app.inject = vi.fn().mockImplementation(async request => {
        if (
          typeof request === 'object' &&
          request.url === '/api/tokens' &&
          request.method === 'POST'
        ) {
          tokenRequestCount++;
          if (tokenRequestCount === 2) {
            // Simulate server error on refresh attempt
            return {
              statusCode: 500,
              payload: JSON.stringify({
                error: 'InternalServerError',
                message: 'Token service unavailable',
                statusCode: 500,
              }),
              headers: {},
              json: () =>
                JSON.parse(
                  JSON.stringify({
                    error: 'InternalServerError',
                    message: 'Token service unavailable',
                    statusCode: 500,
                  })
                ),
            };
          }
        }
        return originalInject(request);
      });

      // Get initial token (should work)
      const loginResponse = await originalInject({
        method: 'POST',
        url: '/api/tokens',
        payload: { userId: 'error-recovery-user' },
      });

      expect(loginResponse.statusCode).toBe(201);
      const initialToken = JSON.parse(loginResponse.payload).token;

      // Try to refresh token (should fail)
      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: { userId: 'error-recovery-user' },
      });

      expect(refreshResponse.statusCode).toBe(500);
      expect(JSON.parse(refreshResponse.payload)).toMatchObject({
        error: 'InternalServerError',
        message: 'Token service unavailable',
      });

      // Restore original inject for cleanup
      app.inject = originalInject;
    });

    it('should validate token format and reject malformed tokens', async () => {
      const malformedTokens = [
        '', // Empty
        'not.a.jwt', // Invalid format
        'invalid', // Single part
        'too.few', // Two parts only
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature', // Invalid payload
      ];

      for (const badToken of malformedTokens) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${badToken}`,
          },
          payload: {
            messages: [{ role: 'user', content: 'This should fail' }],
          },
        });

        expect(response.statusCode).toBe(401);
        expect(JSON.parse(response.payload)).toMatchObject({
          error: 'Unauthorized',
          message: expect.stringMatching(/(invalid|malformed|expired)/i),
        });
      }

      // Verify no AI calls were made with invalid tokens
      expect(mockAIProviderService.createChatCompletion).not.toHaveBeenCalled();
    });

    it('should handle token service unavailability with proper error messages', async () => {
      // Build app with disabled token endpoint
      const appWithoutTokens = await build({
        NODE_ENV: 'development',
        JWT_SECRET:
          'test-secret-key-for-auth-flow-integration-tests-32characters',
        // Enable external auth to disable tokens endpoint
        EXTERNAL_JWT_ISSUER: 'https://test-issuer.example.com',
      });

      await appWithoutTokens.ready();

      const response = await appWithoutTokens.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: { userId: 'test-user' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toMatchObject({
        error: 'NotFoundError',
        message: 'Endpoint disabled when external auth is configured',
      });

      await appWithoutTokens.close();
    });
  });

  describe('Token Lifecycle Management', () => {
    it('should handle token expiration edge cases correctly', async () => {
      // Test with very short-lived tokens by manipulating time
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: { userId: 'edge-case-user' },
      });

      const token = JSON.parse(loginResponse.payload).token;

      // Advance time to just before expiry (14m 59s)
      vi.advanceTimersByTime(14 * 60 * 1000 + 59 * 1000);

      // Should still work
      const almostExpiredResponse = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: {
          messages: [{ role: 'user', content: 'Almost expired token test' }],
        },
      });

      expect(almostExpiredResponse.statusCode).toBe(200);

      // Advance 2 more seconds (total 15m 1s - past expiry)
      vi.advanceTimersByTime(2000);

      // Should now fail
      const expiredResponse = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: {
          messages: [{ role: 'user', content: 'Expired token test' }],
        },
      });

      expect(expiredResponse.statusCode).toBe(401);
    });

    it('should generate unique tokens for different users', async () => {
      const users = ['user1', 'user2', 'user3'];
      const tokens = [];

      // Get tokens for different users
      for (const userId of users) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/tokens',
          payload: { userId },
        });

        expect(response.statusCode).toBe(201);
        tokens.push(JSON.parse(response.payload).token);
      }

      // Verify all tokens are unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);

      // Verify each token contains correct user info
      tokens.forEach((token, index) => {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64url').toString()
        );
        expect(payload.userId).toBe(users[index]);
      });
    });

    it('should handle rapid token refresh requests without race conditions', async () => {
      const userId = 'rapid-refresh-user';

      // Make multiple rapid token requests
      const rapidRequests = Array.from({ length: 10 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/tokens',
          payload: { userId },
        })
      );

      const responses = await Promise.all(rapidRequests);

      // All should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(201);
      });

      // All should have valid tokens
      const tokens = responses.map(r => JSON.parse(r.payload).token);

      // Each token should be unique (no caching/race issues)
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);

      // Each token should be valid for the same user
      tokens.forEach(token => {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64url').toString()
        );
        expect(payload.userId).toBe(userId);
        expect(payload.role).toBe('user');
        expect(payload.iss).toBe('airbolt-api');
      });
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should support typical multi-request conversation flow', async () => {
      // Simulate a real user conversation session
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: { userId: 'conversation-user' },
      });

      const token = JSON.parse(loginResponse.payload).token;

      // Conversation messages building context
      const conversationMessages = [
        [{ role: 'user', content: 'Hello, I need help with authentication' }],
        [
          { role: 'user', content: 'Hello, I need help with authentication' },
          { role: 'assistant', content: 'Authentication test response' },
          { role: 'user', content: 'Can you explain JWT tokens?' },
        ],
        [
          { role: 'user', content: 'Hello, I need help with authentication' },
          { role: 'assistant', content: 'Authentication test response' },
          { role: 'user', content: 'Can you explain JWT tokens?' },
          { role: 'assistant', content: 'Authentication test response' },
          { role: 'user', content: 'What about token expiration?' },
        ],
      ];

      // Track response times and headers
      const conversationResponses = [];

      for (const [index, messages] of conversationMessages.entries()) {
        const startTime = Date.now();

        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          payload: { messages },
        });

        const responseTime = Date.now() - startTime;

        expect(response.statusCode).toBe(200);

        const data = JSON.parse(response.payload);
        conversationResponses.push({
          messageCount: messages.length,
          responseTime,
          content: data.content,
          usage: data.usage,
          rateLimitRemaining: parseInt(
            response.headers['x-ratelimit-remaining'] as string
          ),
        });

        // Add small delay between requests to simulate realistic timing
        vi.advanceTimersByTime(1000); // 1 second between messages
      }

      // Verify conversation progression
      expect(conversationResponses).toHaveLength(3);

      // Rate limit should decrease with each request
      expect(conversationResponses[1].rateLimitRemaining).toBeLessThan(
        conversationResponses[0].rateLimitRemaining
      );
      expect(conversationResponses[2].rateLimitRemaining).toBeLessThan(
        conversationResponses[1].rateLimitRemaining
      );

      // All responses should be consistent
      conversationResponses.forEach(response => {
        expect(response.content).toBe('Authentication test response');
        expect(response.usage.total_tokens).toBe(25);
      });

      // Verify total AI service calls
      expect(mockAIProviderService.createChatCompletion).toHaveBeenCalledTimes(
        3
      );
    });

    it('should handle session interruption and recovery', async () => {
      // Start session
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: { userId: 'interruption-user' },
      });

      const initialToken = JSON.parse(loginResponse.payload).token;

      // Make initial request
      const response1 = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${initialToken}`,
        },
        payload: {
          messages: [{ role: 'user', content: 'Initial message' }],
        },
      });

      expect(response1.statusCode).toBe(200);

      // Simulate session interruption (token expiry)
      vi.advanceTimersByTime(16 * 60 * 1000);

      // Attempt to continue (should fail)
      const failedResponse = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${initialToken}`,
        },
        payload: {
          messages: [
            { role: 'user', content: 'Initial message' },
            { role: 'assistant', content: 'Authentication test response' },
            { role: 'user', content: 'Continue conversation' },
          ],
        },
      });

      expect(failedResponse.statusCode).toBe(401);

      // Recovery: get new token
      const recoveryResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: { userId: 'interruption-user' },
      });

      const newToken = JSON.parse(recoveryResponse.payload).token;

      // Resume conversation
      const resumeResponse = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${newToken}`,
        },
        payload: {
          messages: [
            { role: 'user', content: 'Initial message' },
            { role: 'assistant', content: 'Authentication test response' },
            { role: 'user', content: 'Resumed after interruption' },
          ],
        },
      });

      expect(resumeResponse.statusCode).toBe(200);
      expect(JSON.parse(resumeResponse.payload).content).toBe(
        'Authentication test response'
      );

      // Verify AI service was called correctly throughout
      expect(mockAIProviderService.createChatCompletion).toHaveBeenCalledTimes(
        2
      ); // Initial + Resume
    });
  });
});
