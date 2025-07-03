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
});
