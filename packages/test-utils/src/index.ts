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

// SSE testing utilities
export {
  SSETestServer,
  type SSEScenario,
  type SSEEvent,
} from './sse-test-server.js';
export { SSEScenarioBuilder, SSETestUtils } from './sse-test-utils.js';
