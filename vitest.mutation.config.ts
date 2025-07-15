/**
 * Separate Vitest config for mutation testing
 * Required due to Stryker incompatibility with Vitest workspace mode
 * TODO: Remove when https://github.com/stryker-mutator/stryker-js/issues/[workspace-support] is fixed
 *
 * ⚠️  WARNING: This config MUST stay synchronized with vitest.base.config.ts
 *
 * Shared properties are imported from vitest.base.config.ts to ensure consistency.
 * Only mutation-testing-specific overrides are defined here.
 *
 * Run `pnpm test:config:verify` after making changes to ensure consistency.
 */
import { defineConfig, mergeConfig } from 'vitest/config';
import { baseConfig } from './vitest.base.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Disable workspace mode for Stryker compatibility
      workspace: undefined,

      // Directly include test files instead of using workspace
      include: [
        // Core LLM business logic tests
        'apps/backend-api/test/services/openai.unit.test.ts',

        // Token management tests
        'packages/sdk/test/core/token-manager.test.ts',

        // Rate limiting tests
        'apps/backend-api/test/plugins/rate-limit.test.ts',
      ],

      // Use forks to support NODE_OPTIONS
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
          execArgv: ['--import', 'tsx'],
        },
      },
    },

    // Note: resolve config is inherited from baseConfig
    // This ensures module resolution stays synchronized
  })
);
