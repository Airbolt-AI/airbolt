// @ts-check
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * Stryker Mutation Testing Configuration for Critical Auth Decision Points
 * 
 * This configuration follows TESTING.md principles:
 * - Focuses ONLY on critical decision points: auth checks, retry logic, rate limits
 * - Skips mutations on error messages, config objects, data transformations  
 * - Targets files with patterns like: if (!isValid) throw, shouldRetry(error), requests > limit
 * - Uses incremental mode for fast CI runs (~80-95% faster on repeat runs)
 * 
 * Coverage: 8 critical files with ~1189 potential mutants
 * Focus: Authentication validation, JWT verification, token expiry, retry conditions
 * 
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
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
  
  // Coverage analysis to only run relevant tests
  coverageAnalysis: 'perTest',

  ignorePatterns: [
    'node_modules',
    '.stryker-tmp',
    'dist',
    'coverage',
    'test/**',
  ],

  // MUTATION TARGETS - Focus on critical decision points (per TESTING.md)
  // Target ONLY critical business logic: auth checks, rate limits, retry conditions, token expiry
  mutate: [
    // Critical auth decision points - if (!isValid) throw patterns
    'packages/auth/src/utils/auth-mode-detector.ts', // AuthMode.detect() - critical mode selection
    'apps/backend-api/src/utils/auth-providers.ts', // JWT validation and provider detection logic
    'packages/auth/src/validators/external.ts', // External JWT validation decisions
    'packages/auth/src/utils/token-validator.ts', // Token validation and user ID extraction decisions
    'packages/auth/src/utils/validation-policy.ts', // Policy validation critical paths
    
    // Retry logic and critical system decisions - shouldRetry(error) patterns  
    'apps/backend-api/src/services/ai-provider.ts', // shouldRetry(), provider switching logic
    'packages/sdk/src/core/token-manager.ts', // Token expiration checks, refresh conditions
    'apps/backend-api/src/plugins/rate-limit.ts', // Rate limit calculations - requests > limit
  ],

  // FOCUS ON LOGIC MUTATIONS ONLY (per TESTING.md)
  mutator: {
    excludedMutations: [
      // Skip mutations on data structures and literals
      'StringLiteral',        // Error messages, configuration strings
      'ObjectLiteral',        // Configuration objects
      'ArrayDeclaration',     // Data transformations
      'BlockStatement',       // Logging blocks
      
      // Skip mutations that don't affect critical decision logic
      'TemplateString',       // Template literals used in logging/errors
      'ConditionalExpression', // Ternary operators in non-critical paths
    ],
  },

  // Ignore static mutants (they take 94% of time but provide little value)
  ignoreStatic: true,

  // Disable warnings about slow static mutants since we're ignoring them
  warnings: {
    slow: false
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
