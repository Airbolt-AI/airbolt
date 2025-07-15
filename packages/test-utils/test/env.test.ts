import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTestEnv,
  createProductionTestEnv,
  createDevelopmentTestEnv,
  createMinimalTestEnv,
  TEST_ENV_PRESETS,
} from '../src/env.js';

describe('Test Environment Utilities', () => {
  beforeEach(() => {
    // Clear all stubs before each test
    vi.unstubAllEnvs();
  });

  describe('createTestEnv', () => {
    it('should set comprehensive default test environment', () => {
      const env = createTestEnv();

      expect(env).toMatchObject({
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-test1234567890abcdef',
        JWT_SECRET: 'test-jwt-secret-for-testing-purposes-only-32chars',
        ALLOWED_ORIGIN: 'http://localhost:3000,http://localhost:3001',
        RATE_LIMIT_MAX: '100',
        RATE_LIMIT_TIME_WINDOW: '60000',
        TRUST_PROXY: 'false',
        LOG_LEVEL: 'error',
        PORT: '3000',
      });

      // Verify environment variables are actually set
      expect(process.env['NODE_ENV']).toBe('test');
      expect(process.env['OPENAI_API_KEY']).toBe('sk-test1234567890abcdef');
    });

    it('should allow overriding specific environment variables', () => {
      const env = createTestEnv({
        RATE_LIMIT_MAX: '10',
        CUSTOM_VAR: 'custom-value',
      });

      expect(env['RATE_LIMIT_MAX']).toBe('10');
      expect(env['CUSTOM_VAR']).toBe('custom-value');
      expect(env['NODE_ENV']).toBe('test'); // Default preserved

      expect(process.env['RATE_LIMIT_MAX']).toBe('10');
      expect(process.env['CUSTOM_VAR']).toBe('custom-value');
    });

    it('should return the complete environment configuration', () => {
      const env = createTestEnv({ EXTRA: 'value' });

      // Should include defaults + overrides
      expect(Object.keys(env)).toContain('NODE_ENV');
      expect(Object.keys(env)).toContain('OPENAI_API_KEY');
      expect(Object.keys(env)).toContain('EXTRA');
    });
  });

  describe('createProductionTestEnv', () => {
    it('should set production-appropriate defaults', () => {
      const env = createProductionTestEnv();

      expect(env['NODE_ENV']).toBe('production');
      expect(env['ALLOWED_ORIGIN']).toBe('https://example.com');
      expect(env['JWT_SECRET']).toBe(
        'production-strength-secret-32-chars-minimum-length'
      );
      expect(env['LOG_LEVEL']).toBe('warn');

      expect(process.env['NODE_ENV']).toBe('production');
    });

    it('should allow overriding production defaults', () => {
      const env = createProductionTestEnv({
        ALLOWED_ORIGIN: 'https://custom.com',
        CUSTOM_PROD: 'value',
      });

      expect(env['ALLOWED_ORIGIN']).toBe('https://custom.com');
      expect(env['CUSTOM_PROD']).toBe('value');
      expect(env['NODE_ENV']).toBe('production'); // Still production
    });
  });

  describe('createDevelopmentTestEnv', () => {
    it('should set development-appropriate defaults', () => {
      const env = createDevelopmentTestEnv();

      expect(env['NODE_ENV']).toBe('development');
      expect(env['ALLOWED_ORIGIN']).toBe('*');
      expect(env['LOG_LEVEL']).toBe('debug');

      expect(process.env['NODE_ENV']).toBe('development');
    });

    it('should allow overriding development defaults', () => {
      const env = createDevelopmentTestEnv({
        ALLOWED_ORIGIN: 'http://localhost:8080',
        DEV_FEATURE: 'enabled',
      });

      expect(env['ALLOWED_ORIGIN']).toBe('http://localhost:8080');
      expect(env['DEV_FEATURE']).toBe('enabled');
      expect(env['NODE_ENV']).toBe('development');
    });
  });

  describe('createMinimalTestEnv', () => {
    it('should set only NODE_ENV by default', () => {
      const env = createMinimalTestEnv();

      expect(env).toEqual({
        NODE_ENV: 'test',
      });

      expect(process.env['NODE_ENV']).toBe('test');
    });

    it('should allow custom environment', () => {
      const env = createMinimalTestEnv('production');

      expect(env['NODE_ENV']).toBe('production');
      expect(process.env['NODE_ENV']).toBe('production');
    });

    it('should allow adding specific variables', () => {
      const env = createMinimalTestEnv('test', {
        OPENAI_API_KEY: 'sk-minimal',
        MINIMAL_TEST: 'true',
      });

      expect(env).toEqual({
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'sk-minimal',
        MINIMAL_TEST: 'true',
      });
    });
  });

  describe('TEST_ENV_PRESETS', () => {
    it('should provide standard preset', () => {
      const env = TEST_ENV_PRESETS.standard();
      expect(env['NODE_ENV']).toBe('test');
      expect(env['OPENAI_API_KEY']).toBeDefined();
    });

    it('should provide production preset', () => {
      const env = TEST_ENV_PRESETS.production();
      expect(env['NODE_ENV']).toBe('production');
      expect(env['ALLOWED_ORIGIN']).toBe('https://example.com');
    });

    it('should provide development preset', () => {
      const env = TEST_ENV_PRESETS.development();
      expect(env['NODE_ENV']).toBe('development');
      expect(env['ALLOWED_ORIGIN']).toBe('*');
    });

    it('should provide rate limiting preset', () => {
      const env = TEST_ENV_PRESETS.rateLimiting();
      expect(env['RATE_LIMIT_MAX']).toBe('5');
      expect(env['RATE_LIMIT_TIME_WINDOW']).toBe('1000');
      expect(env['TRUST_PROXY']).toBe('true');
    });

    it('should provide CORS preset', () => {
      const env = TEST_ENV_PRESETS.cors();
      expect(env['ALLOWED_ORIGIN']).toBe(
        'http://localhost:3000,https://example.com'
      );
    });

    it('should provide minimal preset', () => {
      const env = TEST_ENV_PRESETS.minimal();
      expect(env).toEqual({ NODE_ENV: 'test' });
    });
  });

  describe('Environment Isolation', () => {
    it('should not interfere between test runs', () => {
      // First test setup
      createTestEnv({ TEST_VAR: 'first' });
      expect(process.env['TEST_VAR']).toBe('first');

      // Clear and setup second test
      vi.unstubAllEnvs();
      createTestEnv({ TEST_VAR: 'second' });
      expect(process.env['TEST_VAR']).toBe('second');
    });

    it('should handle sequential environment changes', () => {
      createTestEnv();
      expect(process.env['NODE_ENV']).toBe('test');

      createProductionTestEnv();
      expect(process.env['NODE_ENV']).toBe('production');

      createDevelopmentTestEnv();
      expect(process.env['NODE_ENV']).toBe('development');
    });
  });
});
