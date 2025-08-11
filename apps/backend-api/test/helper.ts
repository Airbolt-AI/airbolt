// This file contains code that we reuse between our tests.
import { type FastifyInstance, type LightMyRequestResponse } from 'fastify';

import { type AppOptions } from '../src/app.js';

// Extended AppOptions for tests to include environment variables
export interface TestAppOptions extends AppOptions {
  // Environment variables that tests may need to override
  NODE_ENV?: string;
  AUTH_REQUIRED?: string;
  EXTERNAL_JWT_ISSUER?: string;
  EXTERNAL_JWT_PUBLIC_KEY?: string;
  EXTERNAL_JWT_SECRET?: string;
  EXTERNAL_JWT_AUDIENCE?: string;
  JWT_SECRET?: string;
  VALIDATE_JWT?: string;
  DATABASE_URL?: string;
  OPENAI_API_KEY?: string;
  ALLOWED_ORIGIN?: string;
  REQUEST_LIMIT_MAX?: string;
  REQUEST_LIMIT_TIME_WINDOW?: string;
  TOKEN_LIMIT_MAX?: string;
  TOKEN_LIMIT_TIME_WINDOW?: string;
  AUTH_RATE_LIMIT_MAX?: string;
  AUTH_RATE_LIMIT_WINDOW_MS?: string;
}

// Default test configuration
const defaultConfig: Partial<TestAppOptions> = {
  logger: false, // Disable logging in tests for cleaner output
};

/**
 * Build a Fastify app instance for testing
 * This replaces the fastify-cli helper for better Vitest integration
 */
export async function build(
  config: Partial<TestAppOptions> = {}
): Promise<FastifyInstance> {
  // Extract environment variables from config and set them
  const {
    NODE_ENV,
    AUTH_REQUIRED,
    EXTERNAL_JWT_ISSUER,
    EXTERNAL_JWT_PUBLIC_KEY,
    EXTERNAL_JWT_SECRET,
    EXTERNAL_JWT_AUDIENCE,
    JWT_SECRET,
    VALIDATE_JWT,
    DATABASE_URL,
    OPENAI_API_KEY,
    ALLOWED_ORIGIN,
    REQUEST_LIMIT_MAX,
    REQUEST_LIMIT_TIME_WINDOW,
    TOKEN_LIMIT_MAX,
    TOKEN_LIMIT_TIME_WINDOW,
    AUTH_RATE_LIMIT_MAX,
    AUTH_RATE_LIMIT_WINDOW_MS,
    ...appConfig
  } = config;

  // Store original environment for cleanup
  const originalEnv: Record<string, string | undefined> = {};

  // Set test environment variables
  const envVars = {
    NODE_ENV,
    AUTH_REQUIRED,
    EXTERNAL_JWT_ISSUER,
    EXTERNAL_JWT_PUBLIC_KEY,
    EXTERNAL_JWT_SECRET,
    EXTERNAL_JWT_AUDIENCE,
    JWT_SECRET,
    VALIDATE_JWT,
    DATABASE_URL,
    OPENAI_API_KEY,
    ALLOWED_ORIGIN,
    REQUEST_LIMIT_MAX,
    REQUEST_LIMIT_TIME_WINDOW,
    TOKEN_LIMIT_MAX,
    TOKEN_LIMIT_TIME_WINDOW,
    AUTH_RATE_LIMIT_MAX,
    AUTH_RATE_LIMIT_WINDOW_MS,
  };

  Object.entries(envVars).forEach(([key, value]) => {
    originalEnv[key] = process.env[key];
    if (value !== undefined) {
      if (value === '') {
        // Empty string means delete the env var
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  // Use the buildApp function from app.ts instead of manually building
  // This ensures we get the same configuration as the main app
  const mergedConfig = { ...defaultConfig, ...appConfig };
  const app = await import('../src/app.js').then(m => m.buildApp(mergedConfig));

  // Add cleanup hook to restore environment
  app.addHook('onClose', async () => {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  return app;
}

/**
 * Create a test app instance with automatic cleanup
 * Use this in test suites that need lifecycle management
 */
export async function createTestApp(
  config: Partial<TestAppOptions> = {}
): Promise<{
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

/**
 * Creates a mock JWT token for testing purposes
 * These tokens are NOT cryptographically valid, but have the correct structure
 * for our provider detection and basic parsing logic
 */
export function createMockJWT(options: {
  provider: 'clerk' | 'auth0' | 'firebase';
  userId: string;
  email?: string;
  expiresInSeconds?: number;
}): string {
  const { provider, userId, email, expiresInSeconds = 3600 } = options;

  const now = Math.floor(Date.now() / 1000);

  // Create header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // Create payload based on provider
  let payload: any = {
    sub: userId,
    iat: now,
    exp: now + expiresInSeconds,
  };

  switch (provider) {
    case 'clerk':
      payload = {
        ...payload,
        iss: 'https://test-clerk-account.clerk.accounts.dev',
        aud: 'test-audience',
        user_id: userId,
        email,
      };
      break;
    case 'auth0':
      payload = {
        ...payload,
        iss: 'https://test-domain.auth0.com/',
        aud: 'test-audience',
        email,
      };
      break;
    case 'firebase':
      payload = {
        ...payload,
        iss: 'https://securetoken.google.com/test-project',
        aud: 'test-project',
        auth_time: now,
        email,
      };
      break;
  }

  // Base64url encode (simplified for testing)
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Create a mock signature (not cryptographically valid)
  const signature = btoa('mock-signature')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Legacy exports for backwards compatibility with existing tests
export { build as default };
export const config = () => defaultConfig;
