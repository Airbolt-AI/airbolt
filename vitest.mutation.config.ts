/**
 * Vitest config for mutation testing with Stryker
 *
 * Key features:
 * - Registers tsx loader via setupFiles for all worker processes
 * - Disables workspace mode (Stryker limitation)
 * - Imports shared config from vitest.base.config.ts
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import { baseConfig } from './vitest.base.config';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    // Register tsx loader in every worker process (in addition to base setup)
    setupFiles: [
      ...(baseConfig.test?.setupFiles || []),
      './vitest.setup.mutation.ts',
    ],

    // Disable workspace mode (Stryker requirement)
    workspace: undefined,

    // Target specific test files for mutation testing
    include: [
      'apps/backend-api/test/services/openai.unit.test.ts',
      'packages/sdk/test/core/token-manager.test.ts',
      'apps/backend-api/test/plugins/rate-limit.test.ts',
    ],
  },
});
