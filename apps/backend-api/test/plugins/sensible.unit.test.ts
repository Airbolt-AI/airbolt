import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Direct import to ensure mutation coverage
import sensiblePlugin from '@airbolt/core/plugins/sensible';

describe('Sensible Plugin Unit Tests', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should register sensible plugin successfully', async () => {
    app = Fastify({ logger: false });
    await app.register(sensiblePlugin);
    await app.ready();

    // Verify sensible decorators are available
    expect(app.httpErrors).toBeDefined();
    expect(app.httpErrors.badRequest).toBeTypeOf('function');
    expect(app.httpErrors.notFound).toBeTypeOf('function');
  });

  it('should provide HTTP error creators', async () => {
    app = Fastify({ logger: false });
    await app.register(sensiblePlugin);
    await app.ready();

    // Test that sensible error creators work
    const badRequestError = app.httpErrors.badRequest('Test error');
    expect(badRequestError.statusCode).toBe(400);
    expect(badRequestError.message).toBe('Test error');

    const notFoundError = app.httpErrors.notFound('Not found');
    expect(notFoundError.statusCode).toBe(404);
    expect(notFoundError.message).toBe('Not found');
  });

  it('should provide assert functionality', async () => {
    app = Fastify({ logger: false });
    await app.register(sensiblePlugin);
    await app.ready();

    // Test assert functionality from sensible
    expect(app.assert).toBeDefined();
    expect(app.assert).toBeTypeOf('function');

    // Test assert works
    expect(() => {
      app.assert(true, 400, 'Should not throw');
    }).not.toThrow();
    expect(() => {
      app.assert(false, 400, 'Should throw');
    }).toThrow();
  });
});
