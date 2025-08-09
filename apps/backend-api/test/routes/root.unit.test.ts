import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Direct import of the root route to ensure mutation coverage
import rootRoute from '../../src/routes/root.js';

describe('Root Route Unit Tests', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should register root route successfully', async () => {
    app = Fastify({ logger: false });
    await app.register(rootRoute);
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/health');
  });

  it('should return correct redirect response', async () => {
    app = Fastify({ logger: false });
    await app.register(rootRoute);
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers).toHaveProperty('location');
    expect(response.headers.location).toBe('/health');
  });

  it('should handle GET request to root path', async () => {
    app = Fastify({ logger: false });
    await app.register(rootRoute);
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/health');
  });
});
