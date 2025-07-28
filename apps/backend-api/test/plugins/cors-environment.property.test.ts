import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import Fastify from 'fastify';
import { createTestEnv, createProductionTestEnv } from '@airbolt/test-utils';

import envPlugin from '@airbolt/core/plugins/env.js';
import corsPlugin from '@airbolt/core/plugins/cors.js';

describe('CORS Environment Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  const createApp = async (nodeEnv: string, allowedOrigin: string) => {
    const app = Fastify({
      logger: false,
    });

    // Setup test environment
    if (nodeEnv === 'production') {
      createProductionTestEnv({
        ALLOWED_ORIGIN: allowedOrigin,
      });
    } else {
      createTestEnv({
        NODE_ENV: nodeEnv,
        ALLOWED_ORIGIN: allowedOrigin,
      });
    }

    await app.register(envPlugin);
    await app.register(corsPlugin);

    // Add test route
    app.get('/test', async () => ({ hello: 'world' }));

    // Cleanup function
    return app;
  };

  it('handles any environment + origin combination safely', async () => {
    // Define the type explicitly to help TypeScript
    type TestConfig = {
      nodeEnv: 'development' | 'production' | 'test';
      allowedOrigins: string[];
    };

    await fc.assert(
      fc.asyncProperty(
        fc
          .constantFrom('development', 'production', 'test')
          .chain((nodeEnv: 'development' | 'production' | 'test') => {
            if (nodeEnv === 'production') {
              // Only valid HTTPS origins for production
              return fc.record({
                nodeEnv: fc.constant(
                  nodeEnv as 'development' | 'production' | 'test'
                ),
                allowedOrigins: fc.array(
                  fc.oneof(
                    fc.constant('https://myapp.com'),
                    fc.constant('https://api.example.com'),
                    fc.constant('https://dashboard.example.com')
                  ),
                  { minLength: 1, maxLength: 2 }
                ),
              }) as fc.Arbitrary<TestConfig>;
            } else {
              // Any origins for development/test
              return fc.record({
                nodeEnv: fc.constant(
                  nodeEnv as 'development' | 'production' | 'test'
                ),
                allowedOrigins: fc.array(
                  fc.oneof(
                    fc.constant('*'),
                    fc.constantFrom(
                      'http://localhost:3000',
                      'http://localhost:5173',
                      'http://localhost:5174',
                      'https://myapp.com',
                      'https://api.example.com'
                    )
                  ),
                  { minLength: 1, maxLength: 3 }
                ),
              }) as fc.Arbitrary<TestConfig>;
            }
          }),
        async ({ nodeEnv, allowedOrigins }) => {
          const app = await createApp(nodeEnv, allowedOrigins.join(','));

          try {
            // Test both allowed and potentially disallowed origins
            const testOrigins = [
              'http://localhost:8080', // Likely not in allowed list
              'https://evil.com', // Definitely not allowed
              'http://localhost:5174', // Common dev port
              ...(allowedOrigins.length > 0 ? [allowedOrigins[0]] : []), // First allowed origin if exists
            ];

            for (const testOrigin of testOrigins.filter(
              (origin): origin is string => Boolean(origin)
            )) {
              const isWildcard = allowedOrigins.includes('*');
              const isExplicitlyAllowed = allowedOrigins.includes(testOrigin);

              // Account for development enhancement: if development + localhost, might be auto-allowed
              const isLocalhostInDev =
                nodeEnv === 'development' &&
                testOrigin.startsWith('http://localhost:') &&
                !isWildcard; // Only if not already wildcard

              const shouldBeAllowed =
                isWildcard || isExplicitlyAllowed || isLocalhostInDev;

              const response = await app.inject({
                method: 'OPTIONS',
                url: '/test',
                headers: {
                  origin: testOrigin,
                  'access-control-request-method': 'GET',
                },
              });

              if (shouldBeAllowed) {
                expect(response.statusCode).toBe(204);
                expect(
                  response.headers['access-control-allow-origin']
                ).toBeDefined();
              } else {
                expect(response.statusCode).toBe(500);
                expect(response.body).toContain('Not allowed by CORS');
              }
            }
          } finally {
            await app.close();
          }
        }
      ),
      { numRuns: 10 } // Reduce runs for faster testing
    );
  });

  it('validates localhost port variations consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000, max: 9999 }), // Port numbers
        fc.constantFrom('development', 'test'), // Only non-production environments for localhost
        async (port, nodeEnv) => {
          const localhostOrigin = `http://localhost:${port}`;
          const app = await createApp(nodeEnv, localhostOrigin);

          try {
            // Test exact match
            const exactMatch = await app.inject({
              method: 'GET',
              url: '/test',
              headers: { origin: localhostOrigin },
            });
            expect(exactMatch.statusCode).toBe(200);

            // Test different port (should be rejected)
            const differentPort = await app.inject({
              method: 'GET',
              url: '/test',
              headers: { origin: `http://localhost:${port + 1}` },
            });
            expect(differentPort.statusCode).toBe(500);

            // Test different protocol (should be rejected)
            const httpsVersion = await app.inject({
              method: 'GET',
              url: '/test',
              headers: { origin: `https://localhost:${port}` },
            });
            expect(httpsVersion.statusCode).toBe(500);
          } finally {
            await app.close();
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('handles multiple development origins correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom(
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:4200',
            'http://localhost:8080'
          ),
          { minLength: 1, maxLength: 3 }
        ),
        async devOrigins => {
          const app = await createApp('development', devOrigins.join(','));

          try {
            // All specified origins should work
            for (const origin of devOrigins) {
              const response = await app.inject({
                method: 'OPTIONS',
                url: '/test',
                headers: {
                  origin,
                  'access-control-request-method': 'POST',
                },
              });

              expect(response.statusCode).toBe(204);
              expect(response.headers['access-control-allow-origin']).toBe(
                origin
              );
            }

            // Non-specified localhost ports should be rejected (until we implement the fix)
            const unspecifiedPort = await app.inject({
              method: 'OPTIONS',
              url: '/test',
              headers: {
                origin: 'http://localhost:9999',
                'access-control-request-method': 'POST',
              },
            });
            expect(unspecifiedPort.statusCode).toBe(500);
          } finally {
            await app.close();
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  // Security-focused property test
  it('maintains security for external domains', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.domain(),
        fc.constantFrom('http', 'https'),
        fc.constantFrom('production', 'development', 'test'),
        async (domain, protocol, nodeEnv) => {
          const allowedOrigin = 'https://myapp.com';
          const testOrigin = `${protocol}://${domain}`;

          const app = await createApp(nodeEnv, allowedOrigin);

          try {
            const response = await app.inject({
              method: 'GET',
              url: '/test',
              headers: { origin: testOrigin },
            });

            // Only myapp.com should be allowed
            if (testOrigin === allowedOrigin) {
              expect(response.statusCode).toBe(200);
            } else {
              expect(response.statusCode).toBe(500);
              expect(response.body).toContain('Not allowed by CORS');
            }
          } finally {
            await app.close();
          }
        }
      ),
      { numRuns: 15 }
    );
  });
});
