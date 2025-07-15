// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'command',
  
  // Run vitest directly with TypeScript support
  commandRunner: {
    command: 'NODE_OPTIONS="--import tsx" pnpm exec vitest run --config vitest.mutation.config.ts',
  },
  
  // Command runner doesn't support coverage analysis or incremental mode
  coverageAnalysis: 'off',
  
  // Faster timeouts
  timeoutMS: 15000,
  timeoutFactor: 1.25,

  // Ignore patterns for Stryker
  ignorePatterns: [
    'node_modules',
    '.stryker-tmp',
    'dist',
    'coverage',
    'test/**',
  ],

  // Focus on critical decision points only
  mutate: [
    // Core LLM service - retry and error handling logic
    'apps/backend-api/src/services/openai.ts',
    
    // Token management - refresh and expiry logic
    'packages/sdk/src/core/token-manager.ts',
    
    // Rate limiting key generation (custom logic)
    'apps/backend-api/src/plugins/rate-limit.ts',
  ],

  // Skip mutations that don't affect logic
  mutator: {
    excludedMutations: [
      'StringLiteral', // Don't mutate error messages
      'ObjectLiteral', // Don't mutate config objects
      'ArrayDeclaration', // Don't mutate data structures
      'BlockStatement', // Don't remove blocks
      'ConditionalExpression', // Focus on if/else not ternary
    ],
  },

  // Thresholds for critical logic only
  thresholds: {
    high: 90, // Excellent - critical paths should be well tested
    low: 85, // Minimum for decision logic
    break: 85, // Fail if critical paths aren't well tested
  },

  // Performance optimizations
  // Use 4 workers locally, 2 in CI for optimal performance
  concurrency: process.env.CI ? 2 : 4,
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,

};

export default config;