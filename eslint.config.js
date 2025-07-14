import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const runtimeSafety = require('./eslint-plugin-ai-patterns.cjs');

export default tseslint.config(
  {
    // Ignore patterns - simplified
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/build',
      '**/*.d.ts',
      '**/coverage',
      '**/.stryker-tmp',
      '**/reports',
      'examples/**', // Documentation examples may have intentional type issues
      '**/examples/**', // Examples in any package
      'packages/*/examples/**', // Package-specific examples
      'packages/sdk/generated/**', // Generated SDK files
      '.sdk-cache/**', // SDK generation cache
      '.claude/**', // Claude Code commands/tools
    ],
  },
  {
    // TypeScript source files - focus on runtime safety only
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.config.ts',
            '*.config.js',
            'vitest.config.ts',
            'vitest.workspace.ts',
            'vite.config.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      security,
      'runtime-safety': runtimeSafety,
    },
    rules: {
      // 1. Runtime Safety (TypeScript can't catch these)
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'warn', // Warn for Fastify patterns
      '@typescript-eslint/restrict-template-expressions': 'warn', // Allow for logging

      // 2. Security patterns (runtime behavior)
      'security/detect-object-injection': 'error',
      'security/detect-unsafe-regex': 'error',

      // 3. Custom runtime patterns
      'runtime-safety/no-direct-env-access': 'error',
      'runtime-safety/require-zod-validation': 'error',
      'runtime-safety/require-property-tests': 'error',

      // 4. Module boundaries
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // Everything else: Let TypeScript handle it!
      // These are now redundant with @tsconfig/strictest:
      '@typescript-eslint/no-unused-vars': 'off', // Use noUnusedLocals in tsconfig
      '@typescript-eslint/no-explicit-any': 'off', // strict mode handles
      '@typescript-eslint/explicit-function-return-type': 'off', // Use explicit-module-boundary-types
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // strictest handles
      '@typescript-eslint/prefer-optional-chain': 'off', // strictest handles
      '@typescript-eslint/no-unnecessary-condition': 'off', // strictest handles
    },
  },
  {
    // Config package - allow env access (this is where validation happens)
    files: ['packages/config/**/*.ts'],
    rules: {
      'runtime-safety/no-direct-env-access': 'off',
    },
  },
  {
    // Legacy complex property testing framework - relaxed rules for backward compatibility
    files: [
      'packages/types/src/property-testing.ts',
      'packages/types/src/api-fuzzing.ts',
      'packages/types/src/model-based-testing.ts',
    ],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Legacy framework uses implicit returns
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    // Plugin and route files - Fastify plugins/routes often need async but may not use await
    files: [
      '**/plugins/**/*.ts',
      '**/src/plugins/**/*.ts',
      '**/routes/**/*.ts',
      '**/src/routes/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    // Test files - very minimal rules (TypeScript already validates these)
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/test/**/*.ts',
      '**/*.config.ts',
      '**/*.config.js',
    ],
    extends: [tseslint.configs.recommended],
    rules: {
      // Disable almost all rules for tests and config files
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      'runtime-safety/no-direct-env-access': 'off',
      'runtime-safety/require-zod-validation': 'off',
      'runtime-safety/require-property-tests': 'off',
      'security/detect-object-injection': 'off',
    },
  }
);
