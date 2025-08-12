import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { AirboltClient, TokenManager, TokenError } from '../../src/core/index';

/**
 * Integration tests for the SDK
 *
 * These tests can be run against a real backend or a mock server.
 * Set AIRBOLT_TEST_BASE_URL environment variable to test against a real backend.
 */

const BASE_URL =
  process.env['AIRBOLT_TEST_BASE_URL'] || 'http://localhost:3000';
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
const maybeDescribe = (await isBackendAvailable()) ? describe : describe.skip;

maybeDescribe('SDK Integration Tests', () => {
  let client: AirboltClient;
  let tokenManager: TokenManager;

  beforeAll(async () => {
    // Verify backend is available
    const available = await isBackendAvailable();
    if (!available) {
      console.warn(
        `Backend not available at ${BASE_URL}, skipping integration tests`
      );
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
    });
  });

  describe('Token Management Integration', () => {
    it('should successfully fetch a token from backend', async () => {
      const token = await tokenManager.getToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // JWT format
    });

    it('should reuse token if not expired', async () => {
      const token1 = await tokenManager.getToken();
      const token2 = await tokenManager.getToken();

      expect(token2).toBe(token1);
    });

    it('should get new token after clearing', async () => {
      const token1 = await tokenManager.getToken();
      tokenManager.clearToken();
      const token2 = await tokenManager.getToken();

      expect(token2).not.toBe(token1);
    });

    it('should handle concurrent token requests', async () => {
      tokenManager.clearToken();

      // Make multiple concurrent token requests
      const promises = Array.from({ length: 5 }, () => tokenManager.getToken());
      const tokens = await Promise.all(promises);

      // All should return the same token (no multiple fetches)
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(1);
    });

    it('should handle token fetch errors gracefully', async () => {
      const badTokenManager = new TokenManager({
        baseURL: 'http://localhost:9999', // Non-existent server
        userId: TEST_USER_ID,
        maxRetries: 1,
        retryDelay: 100,
      });

      await expect(badTokenManager.getToken()).rejects.toThrow(TokenError);
    });
  });

  describe('Chat Integration', () => {
    it('should successfully send a chat message', async () => {
      const response = await client.chat([
        { role: 'user', content: 'Hello, this is a test message' },
      ]);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
    });

    it('should handle multi-turn conversations', async () => {
      const response = await client.chat([
        { role: 'user', content: 'What is 2 + 2?' },
        { role: 'assistant', content: 'The answer is 4.' },
        { role: 'user', content: 'What about 3 + 3?' },
      ]);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    it('should include usage information if available', async () => {
      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      // Usage might be optional depending on backend configuration
      if (response.usage) {
        expect(typeof response.usage.total_tokens).toBe('number');
        expect(response.usage.total_tokens).toBeGreaterThan(0);
      }
    });

    it('should handle empty content gracefully', async () => {
      await expect(
        client.chat([
          { role: 'user', content: ' ' }, // Whitespace only
        ])
      ).rejects.toThrow();
    });

    it('should handle very long messages', async () => {
      const longMessage = 'Test '.repeat(1000); // 5000 characters
      const response = await client.chat([
        { role: 'user', content: longMessage },
      ]);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    it('should handle special characters in messages', async () => {
      const specialMessage =
        'Test with special chars: 🚀 émojis, "quotes", \'apostrophes\', \n newlines, and \\backslashes';
      const response = await client.chat([
        { role: 'user', content: specialMessage },
      ]);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network errors', async () => {
      const offlineClient = new AirboltClient({
        baseURL: 'http://localhost:9999', // Non-existent server
        userId: TEST_USER_ID,
      });

      await expect(
        offlineClient.chat([{ role: 'user', content: 'Hello' }])
      ).rejects.toThrow();
    });

    it('should handle token refresh on 401', async () => {
      const response1 = await client.chat([
        { role: 'user', content: 'First message' },
      ]);

      // Clear token to force refresh on next request
      tokenManager.clearToken();

      const response2 = await client.chat([
        { role: 'user', content: 'Second message' },
      ]);

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
    });

    it('should handle invalid message formats', async () => {
      // Test various invalid formats
      const invalidMessages = [
        [], // Empty messages
        [{ role: 'invalid' as any, content: 'test' }], // Invalid role
        [{ role: 'user', content: '' }], // Empty content
      ];

      for (const messages of invalidMessages) {
        await expect(client.chat(messages)).rejects.toThrow();
      }
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent chat requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        client.chat([{ role: 'user', content: `Concurrent request ${i + 1}` }])
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response).toBeDefined();
        expect(response.content).toBeDefined();
      });
    });

    it('should handle sequential requests efficiently', async () => {
      const startTime = Date.now();
      const numRequests = 3;

      for (let i = 0; i < numRequests; i++) {
        const response = await client.chat([
          { role: 'user', content: `Sequential request ${i + 1}` },
        ]);
        expect(response).toBeDefined();
      }

      const duration = Date.now() - startTime;
      // Should complete in reasonable time (adjust based on your backend)
      expect(duration).toBeLessThan(30000); // 30 seconds for 3 requests
    });

    it('should handle mixed success and failure in concurrent requests', async () => {
      const promises = [
        client.chat([{ role: 'user', content: 'Valid request' }]),
        client
          .chat([]) // Invalid: empty messages
          .catch(error => ({ error })),
        client.chat([{ role: 'user', content: 'Another valid request' }]),
      ];

      const results = await Promise.all(promises);

      expect(results[0]).toHaveProperty('content');
      expect(results[1]).toHaveProperty('error');
      expect(results[2]).toHaveProperty('content');
    });
  });

  describe('Client Configuration', () => {
    it('should work with different user IDs', async () => {
      const client1 = new AirboltClient({
        baseURL: BASE_URL,
        userId: 'test-user-1',
      });

      const client2 = new AirboltClient({
        baseURL: BASE_URL,
        userId: 'test-user-2',
      });

      const [response1, response2] = await Promise.all([
        client1.chat([{ role: 'user', content: 'Hello from user 1' }]),
        client2.chat([{ role: 'user', content: 'Hello from user 2' }]),
      ]);

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
    });

    it('should expose client information methods', () => {
      expect(client.getBaseURL()).toBe(BASE_URL);
      expect(client.hasValidToken()).toBe(false); // No token fetched yet

      const tokenInfo = client.getTokenInfo();
      expect(tokenInfo.hasToken).toBe(false);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle a typical conversation flow', async () => {
      // Initial greeting
      const greeting = await client.chat([
        { role: 'user', content: 'Hello! Can you help me with TypeScript?' },
      ]);
      expect(greeting.content).toBeDefined();

      // Follow-up question
      const followUp = await client.chat([
        { role: 'user', content: 'Hello! Can you help me with TypeScript?' },
        { role: 'assistant', content: greeting.content },
        {
          role: 'user',
          content: 'What are the benefits of using interfaces?',
        },
      ]);
      expect(followUp.content).toBeDefined();
    }, 30000); // 30 second timeout for multiple API calls

    it('should recover from temporary network issues', async () => {
      // This test simulates recovery - in real scenario, network might fail temporarily
      const response1 = await client.chat([
        { role: 'user', content: 'Message before network issue' },
      ]);

      // Simulate token expiry
      tokenManager.clearToken();

      // Should recover and get new token
      const response2 = await client.chat([
        { role: 'user', content: 'Message after recovery' },
      ]);

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
    });
  });
});
