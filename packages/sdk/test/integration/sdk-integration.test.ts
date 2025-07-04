import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AirboltClient, TokenManager, AirboltError, TokenError } from '../../src/core/index';

/**
 * Integration tests for the SDK
 * 
 * These tests can be run against a real backend or a mock server.
 * Set AIRBOLT_TEST_BASE_URL environment variable to test against a real backend.
 */

const BASE_URL = process.env.AIRBOLT_TEST_BASE_URL || 'http://localhost:3000';
const TEST_USER_ID = 'sdk-integration-test-user';

// Helper to check if backend is available
async function isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch(BASE_URL);
    return response.ok;
  } catch {
    return false;
  }
}

// Skip integration tests if backend is not available
const maybeDescribe = await isBackendAvailable() ? describe : describe.skip;

maybeDescribe('SDK Integration Tests', () => {
  let client: AirboltClient;
  let tokenManager: TokenManager;

  beforeAll(async () => {
    // Verify backend is available
    const available = await isBackendAvailable();
    if (!available) {
      console.warn(`Backend not available at ${BASE_URL}, skipping integration tests`);
      return;
    }

    console.log(`Running integration tests against ${BASE_URL}`);
  });

  beforeEach(() => {
    tokenManager = new TokenManager({
      baseURL: BASE_URL,
      userId: TEST_USER_ID,
      refreshBuffer: 60, // 1 minute buffer for tests
    });

    client = new AirboltClient({
      baseURL: BASE_URL,
      userId: TEST_USER_ID,
      tokenManager,
      timeout: 10000, // 10 second timeout for integration tests
    });
  });

  describe('Token Management Integration', () => {
    it('should successfully fetch a token from backend', async () => {
      const token = await tokenManager.getToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(tokenManager.hasValidToken()).toBe(true);

      const tokenInfo = tokenManager.getTokenInfo();
      expect(tokenInfo.hasToken).toBe(true);
      expect(tokenInfo.expiresAt).toBeInstanceOf(Date);
      expect(tokenInfo.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle token refresh before expiration', async () => {
      // Create a token manager with very short refresh buffer
      const shortBufferManager = new TokenManager({
        baseURL: BASE_URL,
        userId: TEST_USER_ID,
        refreshBuffer: 3500, // Almost the full token lifetime
      });

      const token1 = await shortBufferManager.getToken();
      const token2 = await shortBufferManager.getToken();

      // Tokens might be different due to refresh
      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
    });

    it('should handle concurrent token requests', async () => {
      const promises = [
        tokenManager.getToken(),
        tokenManager.getToken(),
        tokenManager.getToken(),
      ];

      const tokens = await Promise.all(promises);

      // All tokens should be the same (no race conditions)
      expect(tokens[0]).toBe(tokens[1]);
      expect(tokens[1]).toBe(tokens[2]);
    });

    it('should handle invalid user ID gracefully', async () => {
      const invalidTokenManager = new TokenManager({
        baseURL: BASE_URL,
        userId: '', // Invalid user ID
      });

      // This might succeed or fail depending on backend implementation
      // We're mainly testing that it doesn't crash
      try {
        await invalidTokenManager.getToken();
      } catch (error) {
        expect(error).toBeInstanceOf(TokenError);
      }
    });
  });

  describe('Chat API Integration', () => {
    it('should successfully send a chat message', async () => {
      const response = await client.chat({
        messages: [
          { role: 'user', content: 'Hello, this is a test message' },
        ],
      });

      expect(response).toHaveProperty('content');
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);

      if (response.usage) {
        expect(response.usage.total_tokens).toBeGreaterThan(0);
      }
    });

    it('should handle conversation with multiple messages', async () => {
      const response = await client.chat({
        messages: [
          { role: 'user', content: 'What is 2 + 2?' },
          { role: 'assistant', content: '2 + 2 equals 4.' },
          { role: 'user', content: 'What about 3 + 3?' },
        ],
      });

      expect(response.content).toBeTruthy();
      expect(response.content).toContain('6'); // Likely to contain the answer
    });

    it('should handle system prompt', async () => {
      const response = await client.chat({
        messages: [
          { role: 'user', content: 'Hello' },
        ],
        system: 'You are a helpful assistant that always responds with "Test successful"',
      });

      expect(response.content).toBeTruthy();
      // The exact response depends on the backend implementation
    });

    it('should handle empty user message gracefully', async () => {
      await expect(client.chat({
        messages: [
          { role: 'user', content: ' ' }, // Whitespace only
        ],
      })).rejects.toThrow();
    });

    it('should handle very long message', async () => {
      const longMessage = 'This is a test message. '.repeat(100);
      
      const response = await client.chat({
        messages: [
          { role: 'user', content: longMessage },
        ],
      });

      expect(response.content).toBeTruthy();
    });

    it('should handle maximum number of messages', async () => {
      const messages = Array(50).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i + 1}`,
      }));

      const response = await client.chat({ messages });
      expect(response.content).toBeTruthy();
    });

    it('should fail with too many messages', async () => {
      const messages = Array(51).fill({
        role: 'user' as const,
        content: 'Test message',
      });

      await expect(client.chat({ messages })).rejects.toThrow();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network interruption gracefully', async () => {
      // Create client with invalid base URL
      const invalidClient = new AirboltClient({
        baseURL: 'http://invalid-url-that-does-not-exist.com',
        userId: TEST_USER_ID,
        maxRetries: 1, // Fail fast for tests
        retryDelay: 100,
      });

      await expect(invalidClient.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      })).rejects.toThrow();
    });

    it('should handle token expiration during request', async () => {
      // This is hard to test reliably, but we can at least verify
      // the client handles token refresh correctly
      const response1 = await client.chat({
        messages: [{ role: 'user', content: 'First message' }],
      });

      // Clear token to force refresh
      client.clearToken();

      const response2 = await client.chat({
        messages: [{ role: 'user', content: 'Second message' }],
      });

      expect(response1.content).toBeTruthy();
      expect(response2.content).toBeTruthy();
    });

    it('should handle malformed requests appropriately', async () => {
      // Test various malformed requests
      const malformedRequests = [
        { messages: [] }, // Empty messages
        { messages: [{ role: 'invalid', content: 'test' }] }, // Invalid role
        { messages: [{ role: 'user', content: '' }] }, // Empty content
      ];

      for (const request of malformedRequests) {
        await expect(client.chat(request as any)).rejects.toThrow();
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple concurrent chat requests', async () => {
      const requests = Array(5).fill(null).map((_, i) => 
        client.chat({
          messages: [{ role: 'user', content: `Concurrent request ${i + 1}` }],
        })
      );

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response.content).toBeTruthy();
      });
    });

    it('should maintain performance with rapid sequential requests', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 3; i++) {
        const response = await client.chat({
          messages: [{ role: 'user', content: `Sequential request ${i + 1}` }],
        });
        expect(response.content).toBeTruthy();
      }

      const duration = Date.now() - startTime;
      console.log(`Sequential requests completed in ${duration}ms`);
      
      // This is mainly to ensure requests don't hang indefinitely
      expect(duration).toBeLessThan(30000); // 30 seconds max
    });

    it('should handle mixed success and failure scenarios', async () => {
      const requests = [
        // Valid request
        client.chat({
          messages: [{ role: 'user', content: 'Valid request' }],
        }),
        // Invalid request
        client.chat({
          messages: [], // Invalid: empty messages
        }).catch(error => ({ error })),
        // Another valid request
        client.chat({
          messages: [{ role: 'user', content: 'Another valid request' }],
        }),
      ];

      const results = await Promise.all(requests);

      expect(results[0]).toHaveProperty('content');
      expect(results[1]).toHaveProperty('error');
      expect(results[2]).toHaveProperty('content');
    });
  });

  describe('Client Configuration', () => {
    it('should work with custom timeout settings', async () => {
      const fastTimeoutClient = new AirboltClient({
        baseURL: BASE_URL,
        userId: TEST_USER_ID,
        timeout: 1000, // 1 second timeout
        maxRetries: 1,
      });

      // This should either succeed quickly or timeout
      try {
        const response = await fastTimeoutClient.chat({
          messages: [{ role: 'user', content: 'Quick test' }],
        });
        expect(response.content).toBeTruthy();
      } catch (error) {
        // Timeout is acceptable for this test
        expect(error).toBeInstanceOf(AirboltError);
      }
    });

    it('should work with different retry configurations', async () => {
      const noRetryClient = new AirboltClient({
        baseURL: BASE_URL,
        userId: TEST_USER_ID,
        maxRetries: 1, // No retries
        retryDelay: 100,
      });

      const response = await noRetryClient.chat({
        messages: [{ role: 'user', content: 'No retry test' }],
      });

      expect(response.content).toBeTruthy();
    });
  });
});