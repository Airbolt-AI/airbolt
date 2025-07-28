import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Direct import of the root route to ensure mutation coverage
import rootRoute from '@airbolt/core/routes/root';

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

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload).toEqual({
      message: 'Hello World!',
    });
  });

  it('should return correct message format', async () => {
    app = Fastify({ logger: false });
    await app.register(rootRoute);
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    const payload = JSON.parse(response.payload);
    expect(payload).toHaveProperty('message');
    expect(payload.message).toBe('Hello World!');
    expect(typeof payload.message).toBe('string');
  });

  it('should handle GET request to root path', async () => {
    app = Fastify({ logger: false });
    await app.register(rootRoute);
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });
});
