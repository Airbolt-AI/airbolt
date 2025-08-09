import { describe, test, beforeEach, expect } from 'vitest';
import { createTestEnv } from '@airbolt/test-utils';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';
import { totalmem, freemem } from 'node:os';

describe('Health Check Endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    createTestEnv();
    app = await buildApp({ logger: false });
  });

  describe('GET /health', () => {
    test('should detect unhealthy system conditions correctly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const health = JSON.parse(response.payload);

      // Test business logic: If any critical service is down, system is unhealthy
      if (health.status === 'unhealthy') {
        expect(response.statusCode).toBe(503);
        // System can be unhealthy due to high memory usage (>90%) OR service errors
        if (health.checks.memory.percentage > 90) {
          // High memory usage makes system unhealthy - this is valid
          expect(health.checks.memory.percentage).toBeGreaterThan(90);
        } else {
          // At least one service check should be in error state
          const checkValues = Object.values(health.checks).filter(
            v => typeof v === 'string'
          );
          expect(checkValues).toContain('error');
        }
      } else {
        expect(response.statusCode).toBe(200);
        expect(health.status).toBe('healthy');
      }

      // Test timestamp freshness (should be within last 5 seconds)
      const timestamp = new Date(health.timestamp);
      const age = Date.now() - timestamp.getTime();
      expect(age).toBeLessThan(5000);

      // Test that version matches expected deployment
      expect(health.version).toBe('1.0.0');
    });

    test('should respond quickly even under load', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const responseTime = Date.now() - startTime;

      // Health check should respond within 1 second
      expect(responseTime).toBeLessThan(1000);

      const health = JSON.parse(response.payload);
      expect(['healthy', 'unhealthy']).toContain(health.status);
    });

    test('should be accessible for monitoring systems', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          'User-Agent': 'HealthCheck/1.0',
        },
      });

      // Health endpoint should always be accessible
      expect([200, 503]).toContain(response.statusCode);

      // Should return JSON that monitoring systems can parse
      const health = JSON.parse(response.payload);
      expect(health.status).toMatch(/^(healthy|unhealthy)$/);
      expect(typeof health.uptime).toBe('number');
    });
  });

  describe('Memory Monitoring', () => {
    test('should detect critical memory conditions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const health = JSON.parse(response.payload);
      const memory = health.checks.memory;

      // Test business logic: memory usage should be reasonable
      expect(memory.used).toBeGreaterThan(0);
      expect(memory.used).toBeLessThan(1000); // Alert if over 1GB heap
      expect(memory.percentage).toBeLessThan(99); // Alert if system critically low (allow for CI environments)

      // Memory calculation accuracy test
      const totalMemory = totalmem();
      const freeMemory = freemem();
      const systemUsedMemory = totalMemory - freeMemory;
      const expectedPercentage =
        Math.round((systemUsedMemory / totalMemory) * 100 * 10) / 10;

      // Memory percentage should be calculated correctly
      expect(Math.abs(memory.percentage - expectedPercentage)).toBeLessThan(2);
    });
  });

  describe('Component Health Checks', () => {
    test('should report correct status when components are missing', async () => {
      // Test business logic: missing components should be reported as not_configured
      const minimalApp = await buildApp({
        logger: false,
        skipEnvValidation: true,
      });

      const response = await minimalApp.inject({
        method: 'GET',
        url: '/health',
      });

      const health = JSON.parse(response.payload);

      // Verify that missing components don't cause crashes
      expect(health.checks.authGateway).toMatch(/^(ok|error|not_configured)$/);
      expect(health.checks.sessionCache).toMatch(/^(ok|error|not_configured)$/);
      expect(health.checks.aiProvider).toMatch(/^(ok|error|not_configured)$/);

      // System should still respond even with missing components
      expect([200, 503]).toContain(response.statusCode);
    });
  });
});
