// This file contains code that we reuse between our tests.
import { type FastifyInstance, type LightMyRequestResponse } from 'fastify';

import { type AppOptions } from '../src/app.js';

// Default test configuration
const defaultConfig: Partial<AppOptions> = {
  logger: false, // Disable logging in tests for cleaner output
};

/**
 * Build a Fastify app instance for testing
 * This replaces the fastify-cli helper for better Vitest integration
 */
export async function build(
  config: Partial<AppOptions> = {}
): Promise<FastifyInstance> {
  // Use the buildApp function from app.ts instead of manually building
  // This ensures we get the same configuration as the main app
  const app = await import('../src/app.js').then(m => m.buildApp(config));

  return app;
}

/**
 * Create a test app instance with automatic cleanup
 * Use this in test suites that need lifecycle management
 */
export async function createTestApp(config: Partial<AppOptions> = {}): Promise<{
  app: FastifyInstance;
  cleanup: () => Promise<void>;
}> {
  const app = await build(config);

  const cleanup = async () => {
    await app.close();
  };

  return { app, cleanup };
}

/**
 * Helper for testing route responses
 */
export async function injectRequest(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  payload?: string | object | Buffer | NodeJS.ReadableStream
): Promise<LightMyRequestResponse> {
  const options = {
    method,
    url,
    ...(payload !== undefined && { payload }),
  };

  return app.inject(options);
}

// Legacy exports for backwards compatibility with existing tests
export { build as default };
export const config = () => defaultConfig;
