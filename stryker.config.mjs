// @ts-check
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],

  // TypeScript support via vitest.setup.mutation.ts
  testRunnerNodeArgs: ['--import', require.resolve('tsx')],

  vitest: {
    configFile: 'vitest.mutation.config.ts',
  },

  // Performance optimizations
  timeoutMS: 5000,
  timeoutFactor: 1.5,
  concurrency: process.env.CI ? 2 : 12, // Increase for local development
  disableTypeChecks: true, // Skip TypeScript checking on mutants for speed

  ignorePatterns: [
    'node_modules',
    '.stryker-tmp',
    'dist',
    'coverage',
    'test/**',
  ],

  // MUTATION TARGETS - Focus on critical decision points
  mutate: [
    'apps/backend-api/src/services/openai.ts', // Retry logic, error handling
    'packages/sdk/src/core/token-manager.ts', // Token expiration, refresh logic
    'apps/backend-api/src/plugins/rate-limit.ts', // Rate limit calculations
  ],

  // FOCUS ON LOGIC MUTATIONS ONLY
  mutator: {
    excludedMutations: [
      'StringLiteral',
      'ObjectLiteral',
      'ArrayDeclaration',
      'BlockStatement',
    ],
  },

  thresholds: {
    high: 90,
    low: 70,
    break: null, // No hard threshold - focus on critical decision points
  },

  // Incremental mode: ~80-95% faster on repeat runs
  incremental: true,

  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};

export default config;
