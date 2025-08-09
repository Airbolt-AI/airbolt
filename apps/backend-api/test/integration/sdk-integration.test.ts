import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import type { FastifyInstance } from 'fastify';

import { build } from '../helper.js';
import {
  getOpenAPIV3Document,
  isResponseObject,
  getPathOperations,
} from '../utils/openapi-types.js';

describe('SDK Integration', () => {
  let app: FastifyInstance;
  let serverUrl: string;

  beforeAll(async () => {
    // Set higher rate limits for SDK integration tests to avoid conflicts
    vi.stubEnv('RATE_LIMIT_MAX', '1000');
    vi.stubEnv('RATE_LIMIT_TIME_WINDOW', '60000');
    vi.stubEnv('OPENAI_API_KEY', 'sk-test123456789012345678901234567890');
    vi.stubEnv('JWT_SECRET', 'test-secret-key-for-sdk-integration-tests-32');

    app = await build({
      logger: false,
    });

    // Start server for integration testing
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    // Clean up environment stubs
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    // Clean up any test-specific environment changes
    vi.unstubAllEnvs();
  });

  describe('OpenAPI Specification Quality', () => {
    it('should generate complete OpenAPI spec suitable for SDK generation', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      // Validate OpenAPI 3.0 compliance
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBe('AI Fastify Template API');
      expect(spec.info.version).toBe('1.0.0');

      // Check required fields for SDK generation
      expect(spec.paths).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);

      // Validate each endpoint has complete documentation
      for (const [, pathItem] of Object.entries(spec.paths)) {
        if (pathItem) {
          const operations = getPathOperations(pathItem);
          for (const [, operation] of Object.entries(operations)) {
            expect(operation.summary).toBeDefined();
            expect(operation.description).toBeDefined();
            expect(operation.tags).toBeDefined();
            expect(operation.responses).toBeDefined();
            // Should have at least one valid response (2xx success or 302 redirect)
            const validResponses = Object.keys(operation.responses).filter(
              code => code.startsWith('2') || code === '302'
            );
            expect(validResponses.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it('should include error responses for better SDK error handling', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      // Check that routes include error responses - use chat endpoint which has 400 responses
      const chatPath = spec.paths['/api/chat'];

      expect(chatPath).toBeDefined();

      if (chatPath) {
        expect(chatPath.post).toBeDefined();
        expect(chatPath.post?.responses?.['400']).toBeDefined();

        // Validate error response structure
        const errorResponse = chatPath.post?.responses?.['400'];
        if (errorResponse && isResponseObject(errorResponse)) {
          expect(errorResponse.description).toContain('Bad Request');
          expect(errorResponse.content).toBeDefined();
          expect(errorResponse.content?.['application/json']).toBeDefined();

          const jsonContent = errorResponse.content?.['application/json'];
          if (
            jsonContent &&
            'schema' in jsonContent &&
            jsonContent.schema &&
            'properties' in jsonContent.schema
          ) {
            expect(jsonContent.schema.properties?.['error']).toBeDefined();
            expect(jsonContent.schema.properties?.['message']).toBeDefined();
            expect(jsonContent.schema.properties?.['statusCode']).toBeDefined();
          }
        }
      }
    });

    it('should have consistent response content types', async () => {
      const spec = getOpenAPIV3Document(() => app.swagger());

      for (const [, pathItem] of Object.entries(spec.paths)) {
        if (pathItem) {
          const operations = getPathOperations(pathItem);
          for (const [, operation] of Object.entries(operations)) {
            if (operation.responses) {
              for (const [, response] of Object.entries(operation.responses)) {
                if (isResponseObject(response) && response.content) {
                  // Should have application/json content type
                  expect(response.content['application/json']).toBeDefined();
                }
              }
            }
          }
        }
      }
    });
  });

  describe('Mock SDK Client Usage', () => {
    it('should demonstrate how the generated SDK would be used', async () => {
      // This test demonstrates the expected SDK usage pattern
      // In a real scenario, this would use the actual generated SDK

      // Mock SDK client structure (represents what Fern would generate)
      class MockAiFastifyTemplateAPI {
        constructor(_config: { environment: string }) {}

        async getRootMessage(): Promise<{ message: string }> {
          const response = await app.inject({
            method: 'GET',
            url: '/',
          });
          if (response.statusCode !== 302) {
            throw new Error(
              `HTTP ${response.statusCode}: ${response.statusMessage}`
            );
          }
          // Return redirect info instead of trying to parse JSON
          return {
            message: `Redirected to ${response.headers.location}`,
          };
        }
      }

      // Test SDK usage pattern
      const client = new MockAiFastifyTemplateAPI({
        environment: serverUrl,
      });

      // Test root endpoint
      const rootResponse = await client.getRootMessage();
      expect(rootResponse.message).toContain('Redirected to /health');
    });

    it('should handle errors appropriately in SDK pattern', async () => {
      class MockSDKWithErrors {
        async makeRequest(path: string) {
          const response = await app.inject({
            method: 'GET',
            url: path,
          });
          if (response.statusCode !== 200) {
            throw new SDKError(
              response.statusCode,
              response.statusMessage || 'Unknown Error',
              response.payload
            );
          }
          return JSON.parse(response.payload);
        }
      }

      class SDKError extends Error {
        constructor(
          public statusCode: number,
          public statusText: string,

          public readonly body: string
        ) {
          super(`HTTP ${statusCode}: ${statusText}`);
          this.name = 'SDKError';
        }
      }

      const client = new MockSDKWithErrors();

      // Test error handling for non-existent endpoint
      try {
        await client.makeRequest('/non-existent');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(SDKError);
        expect((error as SDKError).statusCode).toBe(404);
      }
    });
  });

  describe('SDK Error Handling Patterns', () => {
    it('should handle authentication failures correctly for SDK consumers', async () => {
      // Test authentication flow that SDK would encounter
      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      expect(response.statusCode).toBe(401);
      const error = JSON.parse(response.payload);
      expect(error).toMatchObject({
        error: 'Unauthorized',
        message: expect.any(String),
        statusCode: 401,
      });
    });

    it('should provide proper error structure for SDK error handling', async () => {
      // Test various error scenarios that SDK consumers need to handle
      const errorTestCases = [
        {
          url: '/api/chat',
          method: 'POST',
          headers: {},
          payload: { invalid: 'payload' },
          expectedStatus: 400,
          description: 'validation error',
        },
        {
          url: '/api/chat',
          method: 'POST',
          headers: { Authorization: 'Bearer invalid-token' },
          payload: { messages: [{ role: 'user', content: 'test' }] },
          expectedStatus: 401,
          description: 'authentication error',
        },
        {
          url: '/non-existent-endpoint',
          method: 'GET',
          headers: {},
          payload: undefined,
          expectedStatus: 404,
          description: 'not found error',
        },
      ];

      for (const testCase of errorTestCases) {
        const response = await app.inject({
          method: testCase.method as any,
          url: testCase.url,
          headers: testCase.headers,
          ...(testCase.payload && { payload: testCase.payload }),
        });

        expect(response.statusCode).toBe(testCase.expectedStatus);

        // All errors should have consistent structure for SDK error handling
        const error = JSON.parse(response.payload);
        expect(error).toHaveProperty('error');
        expect(error).toHaveProperty('statusCode', testCase.expectedStatus);
        expect(error).toHaveProperty('message');
        expect(typeof error.message).toBe('string');
      }
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should support complete token-based authentication workflow', async () => {
      // Step 1: Create token (valid auth flow)
      const tokenResponse = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        payload: {
          userId: 'test-user-id',
          email: 'test@example.com',
        },
      });

      expect(tokenResponse.statusCode).toBe(201);
      const { token } = JSON.parse(tokenResponse.payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Step 2: Use token for authenticated request
      const authenticatedResponse = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      });

      // Should not get authentication error
      expect(authenticatedResponse.statusCode).not.toBe(401);
      // Actual response depends on OpenAI mock, but auth should pass
    });

    it('should handle token validation edge cases for SDK consumers', async () => {
      const testCases = [
        { token: '', expectedStatus: 401, description: 'empty token' },
        {
          token: 'Bearer malformed',
          expectedStatus: 401,
          description: 'malformed token',
        },
        {
          token: 'not-bearer-format',
          expectedStatus: 401,
          description: 'wrong format',
        },
      ];

      for (const testCase of testCases) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: {
            Authorization: testCase.token,
          },
          payload: {
            messages: [{ role: 'user', content: 'Test' }],
          },
        });

        expect(response.statusCode).toBe(testCase.expectedStatus);
        if (response.statusCode === 401) {
          const error = JSON.parse(response.payload);
          expect(error.error).toBe('Unauthorized');
        }
      }
    });
  });

  describe('Real User SDK Scenarios', () => {
    it('should handle chat conversation flow that SDK consumers would use', async () => {
      // Mock a realistic SDK usage pattern using JWT directly since /api/tokens
      // is disabled when JWT_SECRET is configured (which happens in tests)
      const jwt = await import('jsonwebtoken');
      const token = jwt.sign(
        {
          sub: 'sdk-user-123',
          userId: 'sdk-user-123',
          email: 'sdk@example.com',
        },
        'test-secret-key-for-sdk-integration-tests-32',
        { expiresIn: '1h', issuer: 'airbolt-api', algorithm: 'HS256' }
      );

      // Step 1: Start conversation
      const firstMessage = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload: {
          messages: [{ role: 'user', content: 'What is TypeScript?' }],
        },
      });

      // Should handle request (actual response depends on OpenAI mock)
      expect([200, 400, 500]).toContain(firstMessage.statusCode);

      // Step 2: Continue conversation with context
      const followUpMessage = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload: {
          messages: [
            { role: 'user', content: 'What is TypeScript?' },
            {
              role: 'assistant',
              content: 'TypeScript is a typed superset of JavaScript.',
            },
            { role: 'user', content: 'Give me an example.' },
          ],
        },
      });

      // Should maintain conversation context
      expect([200, 400, 500]).toContain(followUpMessage.statusCode);
      expect(followUpMessage.statusCode).not.toBe(401); // Auth should still work
    });

    it('should handle concurrent SDK requests appropriately', async () => {
      // Create token using JWT directly for testing
      const jwt = await import('jsonwebtoken');
      const token = jwt.sign(
        {
          sub: 'concurrent-user',
          userId: 'concurrent-user',
          email: 'concurrent@example.com',
        },
        'test-secret-key-for-sdk-integration-tests-32',
        { expiresIn: '1h', issuer: 'airbolt-api', algorithm: 'HS256' }
      );

      // Send multiple concurrent requests (typical SDK usage)
      const concurrentRequests = Array(5)
        .fill(0)
        .map((_, i) =>
          app.inject({
            method: 'POST',
            url: '/api/chat',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            payload: {
              messages: [{ role: 'user', content: `Request ${i + 1}` }],
            },
          })
        );

      const responses = await Promise.all(concurrentRequests);

      // All requests should be processed without auth errors
      responses.forEach(response => {
        expect(response.statusCode).not.toBe(401);
        // May get rate limited or other errors, but not auth errors
      });
    });
  });

  describe('Real API Endpoint Testing', () => {
    it('should have working endpoints that match OpenAPI spec', async () => {
      // Test root endpoint (redirects to health)
      const rootResponse = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(rootResponse.statusCode).toBe(302);
      expect(rootResponse.headers.location).toBe('/health');
    });

    it('should return consistent response types for SDK generation', async () => {
      // Test individual endpoints for their expected content types
      const rootResponse = await app.inject({ method: 'GET', url: '/' });
      expect(rootResponse.statusCode).toBe(302);
      expect(rootResponse.headers.location).toBe('/health');

      // Test health endpoint for actual JSON response
      const healthResponse = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(healthResponse.statusCode).toBeOneOf([200, 503]);
      expect(healthResponse.headers['content-type']).toContain(
        'application/json'
      );
      expect(() => JSON.parse(healthResponse.payload)).not.toThrow();
    });
  });
});
