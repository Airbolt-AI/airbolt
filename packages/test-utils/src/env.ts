/**
 * Standardized test environment utilities
 *
 * Provides consistent, reliable test environment setup patterns that prevent
 * CI failures and ensure predictable test behavior across all environments.
 *
 * Key principles:
 * - Always explicit: Never rely on implicit environment setup
 * - Use vitest stubbing: Consistent with vitest best practices
 * - Comprehensive defaults: Cover all required environment variables
 * - Flexible overrides: Allow test-specific customization
 */

import { vi } from 'vitest';
import type { Environment } from '@airbolt/config';

/**
 * Default test environment configuration
 * These are safe defaults that work for most test scenarios
 */
const DEFAULT_TEST_ENV = {
  NODE_ENV: 'test' as const,
  OPENAI_API_KEY: 'sk-test1234567890abcdef',
  JWT_SECRET: 'test-jwt-secret-for-testing-purposes-only-32chars',
  ALLOWED_ORIGIN: 'http://localhost:3000,http://localhost:3001',
  RATE_LIMIT_MAX: '100',
  RATE_LIMIT_TIME_WINDOW: '60000',
  TRUST_PROXY: 'false',
  LOG_LEVEL: 'error',
  PORT: '3000',
} as const;

/**
 * Creates a standard test environment with comprehensive defaults
 *
 * @param overrides - Environment variables to override defaults
 * @returns The complete environment configuration applied
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   createTestEnv(); // Use defaults
 * });
 * ```
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   createTestEnv({
 *     RATE_LIMIT_MAX: '10', // Override for specific test
 *     TRUST_PROXY: 'true'
 *   });
 * });
 * ```
 */
export function createTestEnv(
  overrides: Record<string, string> = {}
): Record<string, string> {
  const env = {
    ...DEFAULT_TEST_ENV,
    ...overrides,
  };

  // Use vitest stubbing for consistent behavior
  Object.entries(env).forEach(([key, value]) => {
    vi.stubEnv(key, value);
  });

  return env;
}

/**
 * Creates a production-like test environment
 * Useful for testing production-specific behavior in tests
 *
 * @param overrides - Additional environment variables to set
 * @returns The production test environment configuration
 *
 * @example
 * ```typescript
 * it('should reject wildcard CORS in production', () => {
 *   createProductionTestEnv();
 *   // Test production-specific validation
 * });
 * ```
 */
export function createProductionTestEnv(
  overrides: Record<string, string> = {}
): Record<string, string> {
  return createTestEnv({
    NODE_ENV: 'production',
    ALLOWED_ORIGIN: 'https://example.com',
    JWT_SECRET: 'production-strength-secret-32-chars-minimum-length',
    LOG_LEVEL: 'warn',
    ...overrides,
  });
}

/**
 * Creates a development-like test environment
 * Useful for testing development-specific behavior in tests
 *
 * @param overrides - Additional environment variables to set
 * @returns The development test environment configuration
 *
 * @example
 * ```typescript
 * it('should allow wildcard CORS in development', () => {
 *   createDevelopmentTestEnv();
 *   // Test development-specific behavior
 * });
 * ```
 */
export function createDevelopmentTestEnv(
  overrides: Record<string, string> = {}
): Record<string, string> {
  return createTestEnv({
    NODE_ENV: 'development',
    ALLOWED_ORIGIN: '*',
    LOG_LEVEL: 'debug',
    ...overrides,
  });
}

/**
 * Creates a minimal test environment with only essential variables
 * Useful for testing environment detection and error handling
 *
 * @param environment - The NODE_ENV value to set
 * @param overrides - Additional environment variables to set
 * @returns The minimal environment configuration
 *
 * @example
 * ```typescript
 * it('should handle missing environment variables gracefully', () => {
 *   createMinimalTestEnv('test', { OPENAI_API_KEY: 'sk-test' });
 *   // Test with minimal environment
 * });
 * ```
 */
export function createMinimalTestEnv(
  environment: Environment = 'test',
  overrides: Record<string, string> = {}
): Record<string, string> {
  const minimalEnv = {
    NODE_ENV: environment,
    ...overrides,
  };

  Object.entries(minimalEnv).forEach(([key, value]) => {
    vi.stubEnv(key, value);
  });

  return minimalEnv;
}

/**
 * Test environment presets for common scenarios
 */
export const TEST_ENV_PRESETS = {
  /** Standard test environment with all defaults */
  standard: () => createTestEnv(),

  /** Production-like environment for security testing */
  production: () => createProductionTestEnv(),

  /** Development-like environment for feature testing */
  development: () => createDevelopmentTestEnv(),

  /** Rate limiting focused environment */
  rateLimiting: () =>
    createTestEnv({
      RATE_LIMIT_MAX: '5',
      RATE_LIMIT_TIME_WINDOW: '1000',
      TRUST_PROXY: 'true',
    }),

  /** CORS testing environment */
  cors: () =>
    createTestEnv({
      ALLOWED_ORIGIN: 'http://localhost:3000,https://example.com',
    }),

  /** Minimal environment for error testing */
  minimal: () => createMinimalTestEnv(),
} as const;
