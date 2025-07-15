// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'command',
  
  commandRunner: {
    command: 'NODE_OPTIONS="--import tsx" pnpm exec vitest run --config vitest.mutation.config.ts',
  },
  
  coverageAnalysis: 'off',
  
  // SIMPLE PERFORMANCE SETTINGS
  timeoutMS: 5000,
  timeoutFactor: 1.5,
  concurrency: process.env.CI ? 2 : 8,  // Max local parallelism
  
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

  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};

export default config;