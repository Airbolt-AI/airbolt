import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';

import envPlugin from '../../src/plugins/env.js';
import corsPlugin from '@airbolt/core/plugins/cors';
import sensiblePlugin from '@airbolt/core/plugins/sensible';

describe('Developer Experience Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createTestApp = async (
    nodeEnv = 'development',
    allowedOrigin = 'http://localhost:5173'
  ) => {
    const app = Fastify({
      logger: false,
    });

    // Mock environment variables for development scenario
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = nodeEnv;
    process.env['OPENAI_API_KEY'] = 'sk-test123';
    process.env['ALLOWED_ORIGIN'] = allowedOrigin;

    await app.register(envPlugin);
    await app.register(sensiblePlugin);
    await app.register(corsPlugin);

    // Add routes that simulate the real API endpoints
    app.post('/api/tokens', async () => {
      return { token: 'test-jwt-token', expiresIn: 3600 };
    });

    app.post('/api/chat', async () => {
      return {
        content: 'Hello! I am an AI assistant.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      };
    });

    // Cleanup function
    const cleanup = () => {
      process.env['NODE_ENV'] = originalEnv;
      return app.close();
    };

    return { app, cleanup };
  };

  it('developer can run all examples simultaneously', async () => {
    // Start backend with realistic default config (the problem scenario)
    const { app, cleanup } = await createTestApp(
      'development',
      'http://localhost:5173'
    );

    try {
      // Simulate developer running multiple examples
      const scenarios = [
        {
          name: 'hooks-demo',
          port: 5173,
          description: 'First React example (should work)',
        },
        {
          name: 'widget-demo',
          port: 5174,
          description: 'Second React example (currently broken)',
        },
        {
          name: 'custom-dev-server',
          port: 3000,
          description: 'Alternative dev setup',
        },
        {
          name: 'angular-dev',
          port: 4200,
          description: 'Angular CLI dev server',
        },
        {
          name: 'node-cli',
          port: null,
          description: 'Server-to-server (no CORS)',
        },
      ];

      for (const scenario of scenarios) {
        const origin = scenario.port
          ? `http://localhost:${scenario.port}`
          : undefined;

        // Test the exact authentication flow that was failing
        const tokenRequest = await app.inject({
          method: 'POST',
          url: '/api/tokens',
          headers: origin ? { origin } : {},
          payload: {},
        });

        // Test chat flow (what developers actually want to do)
        const chatRequest = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: origin ? { origin } : {},
          payload: { message: 'Hello' },
        });

        // After our fix: all development scenarios should work!
        if (scenario.port === null) {
          // Server-to-server: no CORS
          expect(
            tokenRequest.statusCode,
            `${scenario.description} - token request should succeed`
          ).not.toBe(500);
          expect(
            chatRequest.statusCode,
            `${scenario.description} - chat request should succeed`
          ).not.toBe(500);
        } else {
          // All browser scenarios now work in development thanks to wildcard default
          expect(
            tokenRequest.statusCode,
            `${scenario.description} - token request should succeed`
          ).not.toBe(500);
          expect(
            chatRequest.statusCode,
            `${scenario.description} - chat request should succeed`
          ).not.toBe(500);

          expect(tokenRequest.body).not.toContain('Not allowed by CORS');
          expect(chatRequest.body).not.toContain('Not allowed by CORS');
        }
      }
    } finally {
      await cleanup();
    }
  });

  it('simulates the exact SDK failure scenario', async () => {
    // Reproduce the exact error from the logs
    const { app, cleanup } = await createTestApp(
      'development',
      'http://localhost:5173'
    );

    try {
      // Simulate widget-demo running on port 5174 (gets auto-incremented)
      const widgetOrigin = 'http://localhost:5174';

      // Step 1: Browser makes preflight request (what failed in logs)
      const preflight = await app.inject({
        method: 'OPTIONS',
        url: '/api/tokens',
        headers: {
          origin: widgetOrigin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });

      // With our fix, this now works! (development mode uses wildcard default)
      expect(preflight.statusCode).toBe(204);
      expect(preflight.headers['access-control-allow-origin']).toBeDefined();

      // Step 2: Actual request now succeeds
      const actualRequest = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        headers: {
          origin: widgetOrigin,
          'content-type': 'application/json',
        },
        payload: {},
      });

      // This now works thanks to our fix!
      expect(actualRequest.statusCode).toBe(200);
      expect(actualRequest.body).not.toContain('Not allowed by CORS');

      // The SDK no longer needs to retry - the first request succeeds!
    } finally {
      await cleanup();
    }
  });

  it('validates production security is maintained', async () => {
    // Test that production doesn't accidentally become permissive
    const { app, cleanup } = await createTestApp(
      'production',
      'https://myapp.com'
    );

    try {
      const maliciousOrigins = [
        'http://localhost:5173', // Dev origin in prod
        'http://localhost:5174', // Dev origin in prod
        'https://evil.com', // Malicious domain
        'https://myapp.com.evil.com', // Subdomain attack
      ];

      for (const origin of maliciousOrigins) {
        const tokenRequest = await app.inject({
          method: 'POST',
          url: '/api/tokens',
          headers: { origin },
          payload: {},
        });

        const chatRequest = await app.inject({
          method: 'POST',
          url: '/api/chat',
          headers: { origin },
          payload: { message: 'test' },
        });

        // All should be blocked in production
        expect(tokenRequest.statusCode).toBe(500);
        expect(chatRequest.statusCode).toBe(500);
        expect(tokenRequest.body).toContain('Not allowed by CORS');
        expect(chatRequest.body).toContain('Not allowed by CORS');
      }

      // Only the allowed production origin should work
      const legitimateRequest = await app.inject({
        method: 'POST',
        url: '/api/tokens',
        headers: { origin: 'https://myapp.com' },
        payload: {},
      });

      expect(legitimateRequest.statusCode).toBe(200);
      expect(legitimateRequest.body).not.toContain('Not allowed by CORS');
    } finally {
      await cleanup();
    }
  });

  it('demonstrates what should happen after the fix', async () => {
    // This test shows the intended behavior after implementing the fix
    // Currently commented expectations will become the real expectations

    const { app, cleanup } = await createTestApp(
      'development',
      'http://localhost:5173'
    );

    try {
      const developmentPorts = [5173, 5174, 3000, 4200, 8080];

      for (const port of developmentPorts) {
        const origin = `http://localhost:${port}`;

        const response = await app.inject({
          method: 'POST',
          url: '/api/tokens',
          headers: { origin },
          payload: {},
        });

        // After the fix, ALL development ports work!
        expect(response.statusCode).toBe(200);
        expect(response.body).not.toContain('Not allowed by CORS');
      }
    } finally {
      await cleanup();
    }
  });
});
