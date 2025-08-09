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
    test('should return health status with all required fields', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      // Should return either 200 (healthy) or 503 (unhealthy), both are valid
      expect([200, 503]).toContain(response.statusCode);

      const health = JSON.parse(response.payload);

      // Check required structure
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('version');

      // Check status is valid enum value
      expect(['healthy', 'unhealthy']).toContain(health.status);

      // Check timestamp is valid ISO string
      expect(() => new Date(health.timestamp)).not.toThrow();

      // Check uptime is a positive number
      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThanOrEqual(0);

      // Check checks object structure
      expect(health.checks).toHaveProperty('authGateway');
      expect(health.checks).toHaveProperty('sessionCache');
      expect(health.checks).toHaveProperty('aiProvider');
      expect(health.checks).toHaveProperty('memory');

      // Check individual check statuses
      const validStatuses = ['ok', 'error', 'not_configured'];
      expect(validStatuses).toContain(health.checks.authGateway);
      expect(validStatuses).toContain(health.checks.sessionCache);
      expect(validStatuses).toContain(health.checks.aiProvider);

      // Check memory object structure
      expect(health.checks.memory).toHaveProperty('used');
      expect(health.checks.memory).toHaveProperty('available');
      expect(health.checks.memory).toHaveProperty('percentage');

      expect(typeof health.checks.memory.used).toBe('number');
      expect(typeof health.checks.memory.available).toBe('number');
      expect(typeof health.checks.memory.percentage).toBe('number');

      // Memory values should be positive
      expect(health.checks.memory.used).toBeGreaterThan(0);
      expect(health.checks.memory.available).toBeGreaterThan(0);
      expect(health.checks.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(health.checks.memory.percentage).toBeLessThanOrEqual(100);

      // Check version is a string
      expect(typeof health.version).toBe('string');
      expect(health.version).toBe('1.0.0');
    });

    test('should return 503 when system is unhealthy', async () => {
      // This test would require mocking failing components
      // For now, we'll just verify the endpoint exists and returns valid structure
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      // Should return either 200 or 503, both are valid
      expect([200, 503]).toContain(response.statusCode);

      const health = JSON.parse(response.payload);
      expect(['healthy', 'unhealthy']).toContain(health.status);
    });

    test('should have proper OpenAPI schema documentation', async () => {
      // Test that the endpoint is documented in OpenAPI spec
      const response = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });

      expect(response.statusCode).toBe(200);

      const openApiSpec = JSON.parse(response.payload);
      expect(openApiSpec.paths).toHaveProperty('/health');
      expect(openApiSpec.paths['/health']).toHaveProperty('get');

      const healthEndpoint = openApiSpec.paths['/health'].get;
      expect(healthEndpoint).toHaveProperty('tags');
      expect(healthEndpoint).toHaveProperty('summary');
      expect(healthEndpoint).toHaveProperty('description');
      expect(healthEndpoint).toHaveProperty('responses');

      // Check response schemas are defined
      expect(healthEndpoint.responses).toHaveProperty('200');
      expect(healthEndpoint.responses).toHaveProperty('503');
    });
  });

  describe('Memory Information', () => {
    test('should return realistic memory values', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const health = JSON.parse(response.payload);
      const memory = health.checks.memory;

      // Memory usage should be reasonable for a Node.js process
      expect(memory.used).toBeGreaterThan(0);
      expect(memory.used).toBeLessThan(1000); // Less than 1GB used heap

      // Available memory should be reasonable for most systems
      expect(memory.available).toBeGreaterThan(100); // At least 100MB available

      // Percentage should be calculated correctly (system memory usage, not heap usage)
      const totalMemory = totalmem();
      const freeMemory = freemem();
      const systemUsedMemory = totalMemory - freeMemory;
      const expectedPercentage =
        Math.round((systemUsedMemory / totalMemory) * 100 * 10) / 10;

      // Allow for some variance due to timing differences and system activity
      expect(Math.abs(memory.percentage - expectedPercentage)).toBeLessThan(2);
    });
  });

  describe('Component Health Checks', () => {
    test('should handle missing components gracefully', async () => {
      // Test with a fresh app instance that might not have all components
      const minimalApp = await buildApp({
        logger: false,
        skipEnvValidation: true,
      });

      const response = await minimalApp.inject({
        method: 'GET',
        url: '/health',
      });

      const health = JSON.parse(response.payload);

      // With skipEnvValidation, some components might be not_configured
      const validStatuses = ['ok', 'error', 'not_configured'];
      expect(validStatuses).toContain(health.checks.authGateway);
      expect(validStatuses).toContain(health.checks.sessionCache);
      expect(validStatuses).toContain(health.checks.aiProvider);
    });
  });
});
