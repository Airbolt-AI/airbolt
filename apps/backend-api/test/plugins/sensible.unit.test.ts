import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Direct import to ensure mutation coverage
import sensiblePlugin from '../../src/plugins/sensible.js';

describe('Sensible Plugin Business Logic', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should create proper HTTP errors for API validation failures', async () => {
    app = Fastify({ logger: false });
    await app.register(sensiblePlugin);
    await app.ready();

    // Test actual error creation for common API scenarios
    const validationError = app.httpErrors.badRequest(
      'Email format is invalid'
    );
    expect(validationError.statusCode).toBe(400);
    expect(validationError.message).toBe('Email format is invalid');

    const notFoundError = app.httpErrors.notFound('User not found');
    expect(notFoundError.statusCode).toBe(404);
    expect(notFoundError.message).toBe('User not found');
  });

  it('should handle assertion failures properly for critical business rules', async () => {
    app = Fastify({ logger: false });
    await app.register(sensiblePlugin);
    await app.ready();

    // Test assert works for business rule enforcement
    expect(() => {
      app.assert(true, 400, 'Should not throw for valid condition');
    }).not.toThrow();

    expect(() => {
      app.assert(false, 403, 'Insufficient permissions');
    }).toThrowError('Insufficient permissions');
  });
});
