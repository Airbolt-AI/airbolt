/**
 * Testing utilities for the Airbolt monorepo
 *
 * Provides standardized, reliable testing patterns that prevent CI failures
 * and ensure consistent behavior across all test environments.
 */

// Environment testing utilities
export {
  createTestEnv,
  createProductionTestEnv,
  createDevelopmentTestEnv,
  createMinimalTestEnv,
  TEST_ENV_PRESETS,
} from './env.js';
