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
  concurrency: process.env.CI ? 2 : 12,  // Increase for local development
  disableTypeChecks: true,  // Skip TypeScript checking on mutants for speed
  
  ignorePatterns: [
    'node_modules',
    '.stryker-tmp',
    'dist',
    'coverage',
    'test/**',
  ],

  // MUTATION TARGETS
  mutate: [
    'apps/backend-api/src/services/openai.ts',
    'packages/sdk/src/core/token-manager.ts', 
    'apps/backend-api/src/plugins/rate-limit.ts',
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
    low: 85,
    break: 85,
  },

  // Incremental mode: ~80-95% faster on repeat runs
  incremental: true,

  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};

export default config;