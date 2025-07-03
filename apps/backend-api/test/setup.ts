import { beforeAll } from 'vitest';

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
