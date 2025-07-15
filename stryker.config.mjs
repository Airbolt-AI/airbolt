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
  
  // Command runner doesn't support coverage analysis
  coverageAnalysis: 'off',
  
  // PERFORMANCE OPTIMIZATIONS
  // Shorter timeouts - most tests run in <100ms, so 5s is plenty
  timeoutMS: 5000,
  timeoutFactor: 1.5,
  
  // Use available cores efficiently
  concurrency: process.env.CI ? 2 : 6,
  
  // Reuse test runners for speed
  maxTestRunnerReuse: 10,

  // Ignore patterns for Stryker
  ignorePatterns: [
    'node_modules',
    '.stryker-tmp',
    'dist',
    'coverage',
    'test/**',
  ],

  // FOCUSED MUTATION STRATEGY
  // Only mutate the most critical business logic
  mutate: [
    // OpenAI service - retry logic and error handling
    'apps/backend-api/src/services/openai.ts',
    
    // Token management - auth and refresh logic
    'packages/sdk/src/core/token-manager.ts',
    
    // Rate limiting - key generation logic
    'apps/backend-api/src/plugins/rate-limit.ts',
  ],

  // TARGETED EXCLUSIONS
  // Skip mutation types that rarely find real bugs
  mutator: {
    excludedMutations: [
      'StringLiteral',         // Don't mutate strings
      'ObjectLiteral',         // Don't mutate object literals
      'ArrayDeclaration',      // Don't mutate array declarations
      'BlockStatement',        // Don't remove blocks
      'ConditionalExpression', // Skip ternary operators
      'ArithmeticOperator',    // Skip math operators
      'UpdateOperator',        // Skip ++ --
    ],
  },

  // Thresholds for critical logic
  thresholds: {
    high: 90,
    low: 85,
    break: 85,
  },

  // Performance settings
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};

export default config;