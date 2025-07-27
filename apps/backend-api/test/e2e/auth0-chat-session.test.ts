import { describe, expect, test, beforeEach, vi } from 'vitest';
import { build } from '../helper.js';
import type { FastifyInstance } from 'fastify';

describe('Auth0 E2E Chat Session', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (app) {
      await app.close();
    }
    vi.clearAllMocks();
  });

  test('External auth configuration disables internal tokens endpoint', async () => {
    // Setup app with external auth
    app = await build({
      NODE_ENV: 'development',
      EXTERNAL_JWT_ISSUER: 'https://test.auth0.com/',
      JWT_SECRET: 'test-secret-key-for-integration-tests-32characters',
    });

    // Try to get internal token
    const res = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      payload: { userId: 'test-user' },
    });

    // Should be disabled
    expect(res.statusCode).toBe(404);
  });

  test('Chat endpoint requires authentication with external auth configured', async () => {
    app = await build({
      NODE_ENV: 'development',
      EXTERNAL_JWT_ISSUER: 'https://test.auth0.com/',
      JWT_SECRET: 'test-secret-key-for-integration-tests-32characters',
    });

    // No auth header
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      error: 'Unauthorized',
      message: expect.stringContaining('JWT'),
    });
  });

  test('BYOA mode header indicates external auth mode', async () => {
    app = await build({
      NODE_ENV: 'production',
      EXTERNAL_JWT_ISSUER: 'https://production.auth0.com/',
      JWT_SECRET: 'test-secret-key-for-integration-tests-32characters',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { Authorization: 'Bearer invalid-token' },
      payload: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers['x-byoa-mode']).toBe('strict');
  });
});
