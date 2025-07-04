import { beforeAll } from 'vitest';

// Polyfill fetch for Node.js test environment
// Note: Node.js 18+ includes fetch globally, but it may not be available in test environments
if (typeof globalThis.fetch === 'undefined') {
  // Provide a basic fetch implementation for tests
  // Most tests use vitest mocks anyway, so this is mainly for OpenAI service initialization
  globalThis.fetch = async (_input: any, _init?: any) => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map(),
      json: async () => ({}),
      text: async () => '{}',
      blob: async () => new Blob([]),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as any;
  };
  
  globalThis.Request = class MockRequest {
    constructor(_input: any, _init?: any) {}
  } as any;
  
  globalThis.Response = class MockResponse {
    ok = true;
    status = 200;
    statusText = 'OK';
    headers = new Map();
    
    constructor(_body?: any, init?: any) {
      if (init?.status) this.status = init.status;
      this.ok = this.status >= 200 && this.status < 300;
    }
    
    async json() { return {}; }
    async text() { return '{}'; }
    async blob() { return new Blob([]); }
    async arrayBuffer() { return new ArrayBuffer(0); }
  } as any;
  
  globalThis.Headers = class MockHeaders extends Map {
    constructor(_init?: any) {
      super();
    }
  } as any;
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
