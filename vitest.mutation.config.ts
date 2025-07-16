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

    // Include all test files (matches base config behavior for consistency)
    include: [
      'apps/*/test/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
      'apps/*/test/**/*.property.test.ts',
      'packages/*/test/**/*.property.test.ts',
    ],

    // Override the base exclusions to allow react-sdk tests
    exclude: [
      'node_modules/',
      'dist/',
      '**/*.d.ts',
      '**/*.config.*',
      '**/coverage/**',
      '.stryker-tmp/**',
    ],
  },
});
