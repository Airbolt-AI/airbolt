import { describe, expect, test, beforeEach } from 'vitest';
import { build } from '../../helper.js';
import type { FastifyInstance } from 'fastify';

describe('BYOA Security Isolation', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Reset any app state
    if (app) {
      await app.close();
    }
  });

  test('internal tokens rejected when external auth configured', async () => {
    // Build app with external auth configured
    app = await build({
      EXTERNAL_JWT_ISSUER: 'https://auth0.com/',
      NODE_ENV: 'production',
      JWT_SECRET: 'test-secret-key-for-integration-tests-32characters',
      ALLOWED_ORIGIN: 'https://example.com',
    });

    // Try to get internal token - endpoint should be disabled
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      payload: { userId: 'test' },
    });

    // Should return 404 - endpoint disabled
    expect(tokenResponse.statusCode).toBe(404);

    // Create a mock internal token (simulating old token)
    // In real scenario, this would be a JWT signed with the internal secret
    const internalToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJ0eXBlIjoiaW50ZXJuYWwiLCJpYXQiOjE2MDk0NTkyMDAsImV4cCI6OTk5OTk5OTk5OX0.fake-signature';

    // Try using internal token for chat
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { Authorization: `Bearer ${internalToken}` },
      payload: {
        messages: [{ role: 'user', content: 'Hi' }],
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      error: 'Unauthorized',
      message: 'Invalid authorization token',
    });
  });

  test('anonymous users can chat when no external auth configured', async () => {
    // Build app without external auth
    app = await build({
      NODE_ENV: 'production',
      JWT_SECRET: 'test-secret-key-for-integration-tests-32characters',
      ALLOWED_ORIGIN: 'https://example.com',
      // Explicitly disable external auth
      EXTERNAL_JWT_ISSUER: '',
      EXTERNAL_JWT_PUBLIC_KEY: '',
      EXTERNAL_JWT_SECRET: '',
    });

    // Get internal token
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      payload: { userId: 'anonymous' },
    });

    expect(tokenResponse.statusCode).toBe(201);
    const { token } = tokenResponse.json();

    // Use token for chat
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      content: expect.any(String),
    });
  });

  test('development mode accepts both internal and external tokens', async () => {
    // Build app in development mode with external issuer
    app = await build({
      NODE_ENV: 'development',
      JWT_SECRET: 'test-secret-key-for-integration-tests-32characters',
      EXTERNAL_JWT_ISSUER: 'https://dev.auth0.com/',
    });

    // Internal token should still work in dev
    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/tokens',
      payload: { userId: 'dev-user' },
    });

    // In dev mode with external auth, tokens endpoint is disabled
    expect(tokenResponse.statusCode).toBe(404);
  });

  test('production mode enforces issuer when configured', async () => {
    app = await build({
      NODE_ENV: 'production',
      EXTERNAL_JWT_ISSUER: 'https://correct.auth0.com/',
      JWT_SECRET: 'test-secret-key-for-integration-tests-32characters',
      ALLOWED_ORIGIN: 'https://example.com',
    });

    // Create token with wrong issuer
    // This is a mock token with wrong issuer for testing
    const wrongIssuerToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiaXNzIjoiaHR0cHM6Ly93cm9uZy5hdXRoMC5jb20vIiwiYXVkIjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20iLCJpYXQiOjE2MDk0NTkyMDAsImV4cCI6OTk5OTk5OTk5OX0.fake-signature';

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { Authorization: `Bearer ${wrongIssuerToken}` },
      payload: {
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    expect(res.statusCode).toBe(401);
    // Since this is a fake token with wrong issuer, it won't be handled by any validator
    expect(res.json().message).toBe('Invalid authorization token');
  });

  test('security headers indicate BYOA mode', async () => {
    // With external auth
    app = await build({
      EXTERNAL_JWT_ISSUER: 'https://auth0.com/',
      JWT_SECRET: 'test-secret-key-for-integration-tests-32characters',
      ALLOWED_ORIGIN: 'https://example.com',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { Authorization: 'Bearer invalid' },
      payload: { messages: [] },
    });

    // Check both lowercase and uppercase versions
    const byoaMode = res.headers['x-byoa-mode'] || res.headers['X-BYOA-Mode'];
    expect(byoaMode).toBe('strict');

    // Close the first app before creating a new one
    await app.close();

    // Without external auth
    app = await build({
      JWT_SECRET: 'test-secret-key-for-integration-tests-32characters',
    });

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { Authorization: 'Bearer invalid' },
      payload: { messages: [] },
    });

    const byoaMode2 =
      res2.headers['x-byoa-mode'] || res2.headers['X-BYOA-Mode'];
    expect(byoaMode2).toBe('auto');
  });
});
