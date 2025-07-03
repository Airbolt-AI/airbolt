import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { build } from '../../helper.js';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

describe('POST /api/token', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await build();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('successful token generation', () => {
    it('should generate a token with valid origin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/token',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('tokenType');
      expect(body).toHaveProperty('expiresIn');
      expect(body.tokenType).toBe('Bearer');
      expect(body.expiresIn).toBe(900); // Always 15 minutes
      expect(typeof body.token).toBe('string');
      expect(body.token.split('.')).toHaveLength(3);
    });

    it('should generate valid JWT with correct claims', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/token',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      const body = JSON.parse(response.payload);
      const decoded = jwt.decode(body.token) as jwt.JwtPayload;

      expect(decoded).toBeTruthy();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.sub).toBeDefined(); // UUID session identifier
      expect(decoded.aud).toBe('api'); // Audience claim

      // Verify expiration is exactly 15 minutes
      const expirationTime = (decoded.exp ?? 0) - (decoded.iat ?? 0);
      expect(expirationTime).toBe(900);
    });
  });

  describe('origin validation', () => {
    it('should return 400 when origin header is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/token',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain(
        "headers must have required property 'origin'"
      );
      expect(body.statusCode).toBe(400);
    });

    it('should return 403 when origin is not allowed', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/token',
        headers: {
          origin: 'https://malicious-site.com',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Forbidden');
      expect(body.message).toContain('Origin not allowed');
      expect(body.statusCode).toBe(403);
    });

    it('should return 400 for empty origin header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/token',
        headers: {
          origin: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Bad Request');
      expect(body.message).toContain('Origin header is required');
      expect(body.statusCode).toBe(400);
    });
  });

  describe('token verification', () => {
    it('should generate tokens that can be verified by the JWT plugin', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/token',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      const body = JSON.parse(response.payload);
      const verified = app.jwt.verify(body.token);

      expect(verified).toBeTruthy();
      expect((verified as any).sub).toBeDefined();
      expect((verified as any).aud).toBe('api');
      expect((verified as any).iat).toBeDefined();
      expect((verified as any).exp).toBeDefined();
    });
  });

  describe('response format', () => {
    it('should match the expected schema', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/token',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.payload);
      expect(Object.keys(body).sort()).toEqual(
        ['expiresIn', 'token', 'tokenType'].sort()
      );
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limiting on token endpoint', async () => {
      // Token endpoint has specific rate limit: 3 requests per minute (per Linear spec)
      const maxRequests = 3;
      const responses = [];

      // Make requests sequentially
      for (let i = 0; i < maxRequests + 2; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/token',
          headers: {
            origin: 'http://localhost:3000',
          },
        });
        responses.push(response);
      }

      // Count successful and rate-limited responses
      const successCount = responses.filter(r => r.statusCode === 200).length;
      const rateLimitedCount = responses.filter(
        r => r.statusCode === 429
      ).length;

      // Should have exactly maxRequests successful and the rest rate limited
      expect(successCount).toBe(maxRequests);
      expect(rateLimitedCount).toBe(2);

      // Check rate limit error response
      const rateLimitedResponse = responses.find(r => r.statusCode === 429);
      if (rateLimitedResponse) {
        const body = JSON.parse(rateLimitedResponse.payload);
        expect(body.statusCode).toBe(429);
        expect(body.error).toBeDefined();
        expect(body.message).toContain('Too many requests');
      }
    });
  });
});
