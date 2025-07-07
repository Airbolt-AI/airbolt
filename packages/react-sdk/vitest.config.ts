import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// React SDK-specific configuration
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: [],
    include: [
      path.resolve(__dirname, 'test/**/*.test.ts'),
      path.resolve(__dirname, 'test/**/*.test.tsx'),
    ],
    exclude: [
      'node_modules/',
      'dist/',
      '**/*.d.ts',
      '**/*.config.*',
      '**/coverage/**',
      '.stryker-tmp/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@airbolt/sdk': path.resolve(__dirname, '../sdk/src'),
      '@airbolt/types': path.resolve(__dirname, '../types/src'),
    },
    conditions: ['development', 'browser'],
  },
});
