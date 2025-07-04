import { beforeAll } from 'vitest';

// Polyfill fetch for Node.js test environment
// Use Node.js built-in fetch (available in Node 18+)
if (!globalThis.fetch) {
  try {
    // Import from node:undici if available (Node 18+)
    const undici = await import('node:undici');
    globalThis.fetch = undici.fetch;
    globalThis.Request = undici.Request;
    globalThis.Response = undici.Response;
    globalThis.Headers = undici.Headers;
  } catch {
    console.warn('Node.js fetch not available - using mock fetch for tests');
    // Provide a basic mock fetch for tests that don't need real network
    globalThis.fetch = async () => new Response('{}', { status: 200 });
  }
}

// Set up test environment variables
beforeAll(() => {
  // Ensure test environment variables are set
  process.env['NODE_ENV'] = process.env['NODE_ENV'] || 'test';
  process.env['OPENAI_API_KEY'] =
    process.env['OPENAI_API_KEY'] || 'sk-test1234567890abcdef';
  process.env['JWT_SECRET'] =
    process.env['JWT_SECRET'] ||
    'test-jwt-secret-for-testing-purposes-only-32chars';
  process.env['ALLOWED_ORIGIN'] =
    process.env['ALLOWED_ORIGIN'] ||
    'http://localhost:3000,http://localhost:3001';
  // Use more lenient rate limiting for tests
  process.env['RATE_LIMIT_MAX'] = process.env['RATE_LIMIT_MAX'] || '100';
  process.env['RATE_LIMIT_TIME_WINDOW'] =
    process.env['RATE_LIMIT_TIME_WINDOW'] || '60000';
});
