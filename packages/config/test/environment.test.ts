import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getEnvironment,
  isDevelopment,
  isProduction,
  isTest,
} from '../src/environment.js';

describe('environment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getEnvironment', () => {
    // Test all environment variants systematically
    describe.each([
      ['production', 'production'],
      ['PRODUCTION', 'production'],
      ['prod', 'production'],
      ['PROD', 'production'],
      ['test', 'test'],
      ['TEST', 'test'],
      ['development', 'development'],
      ['DEVELOPMENT', 'development'],
      ['dev', 'development'],
      ['DEV', 'development'],
      ['staging', 'development'],
      ['local', 'development'],
      [undefined, 'development'],
      ['', 'development'],
    ])('with NODE_ENV="%s"', (input, expected) => {
      it(`should return "${expected}"`, () => {
        if (input === undefined) {
          delete process.env['NODE_ENV'];
        } else {
          process.env['NODE_ENV'] = input;
        }
        expect(getEnvironment()).toBe(expected);
      });
    });
  });

  describe('isDevelopment', () => {
    it('should return true in development', () => {
      process.env['NODE_ENV'] = 'development';
      expect(isDevelopment()).toBe(true);
    });

    it('should return false in production', () => {
      process.env['NODE_ENV'] = 'production';
      expect(isDevelopment()).toBe(false);
    });

    it('should return true when NODE_ENV is unset', () => {
      delete process.env['NODE_ENV'];
      expect(isDevelopment()).toBe(true);
    });
  });

  describe('isProduction', () => {
    it('should return true for production variants', () => {
      process.env['NODE_ENV'] = 'production';
      expect(isProduction()).toBe(true);

      process.env['NODE_ENV'] = 'prod';
      expect(isProduction()).toBe(true);
    });

    it('should return false for non-production environments', () => {
      process.env['NODE_ENV'] = 'development';
      expect(isProduction()).toBe(false);

      process.env['NODE_ENV'] = 'test';
      expect(isProduction()).toBe(false);

      delete process.env['NODE_ENV'];
      expect(isProduction()).toBe(false);
    });
  });

  describe('isTest', () => {
    it('should return true in test environment', () => {
      process.env['NODE_ENV'] = 'test';
      expect(isTest()).toBe(true);
    });

    it('should return false for non-test environments', () => {
      process.env['NODE_ENV'] = 'production';
      expect(isTest()).toBe(false);

      process.env['NODE_ENV'] = 'development';
      expect(isTest()).toBe(false);

      delete process.env['NODE_ENV'];
      expect(isTest()).toBe(false);
    });
  });
});
