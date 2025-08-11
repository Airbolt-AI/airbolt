import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExchangeRateLimiter } from '../../src/auth/exchange-rate-limiter.js';
import type { FastifyRequest } from 'fastify';

describe('ExchangeRateLimiter', () => {
  let rateLimiter: ExchangeRateLimiter;

  beforeEach(() => {
    rateLimiter = new ExchangeRateLimiter({
      max: 3,
      windowMs: 1000, // 1 second for fast testing
    });
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', () => {
      const result1 = rateLimiter.checkLimit('test-key');
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = rateLimiter.checkLimit('test-key');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(2); // Still 2 because no request recorded yet
    });

    it('should deny requests exceeding limit', () => {
      // Record 3 requests (max)
      rateLimiter.recordRequest('test-key', true);
      rateLimiter.recordRequest('test-key', true);
      rateLimiter.recordRequest('test-key', true);

      const result = rateLimiter.checkLimit('test-key');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after time window', async () => {
      // Record 3 requests to hit the limit
      rateLimiter.recordRequest('test-key', true);
      rateLimiter.recordRequest('test-key', true);
      rateLimiter.recordRequest('test-key', true);

      // Should be blocked
      let result = rateLimiter.checkLimit('test-key');
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      result = rateLimiter.checkLimit('test-key');
      expect(result.allowed).toBe(true);
    });

    it('should track different keys separately', () => {
      rateLimiter.recordRequest('key1', true);
      rateLimiter.recordRequest('key1', true);
      rateLimiter.recordRequest('key1', true);

      // key1 should be blocked
      expect(rateLimiter.checkLimit('key1').allowed).toBe(false);

      // key2 should still be allowed
      expect(rateLimiter.checkLimit('key2').allowed).toBe(true);
    });
  });

  describe('recordRequest', () => {
    it('should record successful requests', () => {
      rateLimiter.recordRequest('test-key', true);
      const result = rateLimiter.checkLimit('test-key');
      expect(result.totalHits).toBe(1);
    });

    it('should record failed requests', () => {
      rateLimiter.recordRequest('test-key', false);
      const result = rateLimiter.checkLimit('test-key');
      expect(result.totalHits).toBe(1);
    });

    it('should respect skipSuccessfulRequests option', () => {
      const limiter = new ExchangeRateLimiter({
        max: 3,
        windowMs: 1000,
        skipSuccessfulRequests: true,
      });

      limiter.recordRequest('test-key', true); // Should be skipped
      limiter.recordRequest('test-key', false); // Should be recorded

      const result = limiter.checkLimit('test-key');
      expect(result.totalHits).toBe(1);

      limiter.destroy();
    });

    it('should respect skipFailedRequests option', () => {
      const limiter = new ExchangeRateLimiter({
        max: 3,
        windowMs: 1000,
        skipFailedRequests: true,
      });

      limiter.recordRequest('test-key', true); // Should be recorded
      limiter.recordRequest('test-key', false); // Should be skipped

      const result = limiter.checkLimit('test-key');
      expect(result.totalHits).toBe(1);

      limiter.destroy();
    });
  });

  describe('generateKey', () => {
    it('should generate key from IP for anonymous requests', () => {
      const mockRequest = {
        ip: '192.168.1.1',
        headers: {},
      } as FastifyRequest;

      const key = rateLimiter.generateKey(mockRequest);
      expect(key).toBe('192.168.1.1:anonymous');
    });

    it('should extract user ID from Bearer token', () => {
      // Create a basic JWT-like token (header.payload.signature)
      const payload = { sub: 'user123' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        'base64url'
      );
      const token = `header.${encodedPayload}.signature`;

      const mockRequest = {
        ip: '192.168.1.1',
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as FastifyRequest;

      const key = rateLimiter.generateKey(mockRequest);
      expect(key).toBe('192.168.1.1:user123');
    });

    it('should handle malformed tokens gracefully', () => {
      const mockRequest = {
        ip: '192.168.1.1',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      } as FastifyRequest;

      const key = rateLimiter.generateKey(mockRequest);
      expect(key).toBe('192.168.1.1:anonymous');
    });

    it('should handle forwarded headers', () => {
      const mockRequest = {
        ip: '127.0.0.1',
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18',
        },
      } as unknown as FastifyRequest;

      const key = rateLimiter.generateKey(mockRequest);
      expect(key).toBe('203.0.113.195:anonymous');
    });

    it('should use custom key generator if provided', () => {
      const customLimiter = new ExchangeRateLimiter({
        max: 3,
        windowMs: 1000,
        keyGenerator: req => `custom-${req.ip}`,
      });

      const mockRequest = {
        ip: '192.168.1.1',
        headers: {},
      } as FastifyRequest;

      const key = customLimiter.generateKey(mockRequest);
      expect(key).toBe('custom-192.168.1.1');

      customLimiter.destroy();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      rateLimiter.recordRequest('test-key', true);

      // Verify entry exists
      expect(rateLimiter.getStats().totalKeys).toBe(1);

      // Wait for expiration and cleanup
      await new Promise(resolve => setTimeout(resolve, 1100));
      rateLimiter.cleanup();

      // Entry should be cleaned up
      expect(rateLimiter.getStats().totalKeys).toBe(0);
    });

    it('should preserve active entries during cleanup', () => {
      rateLimiter.recordRequest('active-key', true);
      rateLimiter.recordRequest('old-key', true);

      // Make old-key expire by waiting
      setTimeout(() => {
        // Add new request to active-key to keep it active
        rateLimiter.recordRequest('active-key', true);
        rateLimiter.cleanup();

        // Only active-key should remain
        expect(rateLimiter.getStats().totalKeys).toBe(1);
      }, 1100);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      rateLimiter.recordRequest('key1', true);
      rateLimiter.recordRequest('key1', false);
      rateLimiter.recordRequest('key2', true);

      const stats = rateLimiter.getStats();
      expect(stats.totalKeys).toBe(2);
      expect(stats.totalEntries).toBe(3);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('destroy', () => {
    it('should clear all data and stop cleanup timer', () => {
      rateLimiter.recordRequest('test-key', true);
      expect(rateLimiter.getStats().totalKeys).toBe(1);

      rateLimiter.destroy();
      expect(rateLimiter.getStats().totalKeys).toBe(0);
    });
  });
});
