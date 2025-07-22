import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@airbolt/sdk': path.resolve(__dirname, '../../sdk/dist/src/index.js'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['@airbolt/sdk'],
  },
  server: {
    fs: {
      strict: false,
      allow: [
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '../..'),
        path.resolve(__dirname, '../../..'),
      ],
    },
  },
});
