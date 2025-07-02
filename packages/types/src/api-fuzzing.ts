import fc from 'fast-check';

/**
 * API Fuzzing Framework Templates
 *
 * Provides templates and generators for API fuzzing tests.
 * These are designed to be used in actual test files with real Fastify instances.
 */

// ===== HTTP METHOD AND STATUS GENERATORS =====

export const httpMethods = fc.constantFrom(
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS'
);

export const httpStatusCodes = {
  success: fc.constantFrom(200, 201, 202, 204),
  clientError: fc.constantFrom(400, 401, 403, 404, 409, 422, 429),
  serverError: fc.constantFrom(500, 502, 503, 504),
  all: fc.constantFrom(
    200,
    201,
    202,
    204,
    400,
    401,
    403,
    404,
    409,
    422,
    429,
    500,
    502,
    503,
    504
  ),
};

// ===== MALICIOUS INPUT GENERATORS =====

/**
 * Generates potentially malicious strings for security testing
 */
export const maliciousStrings = fc.oneof(
  // SQL injection attempts
  fc.constant("'; DROP TABLE users; --"),
  fc.constant("1' OR '1'='1"),
  fc.constant("admin'--"),

  // XSS attempts
  fc.constant("<script>alert('xss')</script>"),
  fc.constant("javascript:alert('xss')"),
  fc.constant("<img src=x onerror=alert('xss')>"),

  // Path traversal
  fc.constant('../../../etc/passwd'),
  fc.constant('..\\..\\..\\windows\\system32\\config\\sam'),

  // Command injection
  fc.constant('; cat /etc/passwd'),
  fc.constant('| ls -la'),
  fc.constant('$(whoami)'),

  // LDAP injection
  fc.constant('*)(uid=*))(|(uid=*'),

  // XXE attempts
  fc.constant(
    "<?xml version='1.0'?><!DOCTYPE root [<!ENTITY test SYSTEM 'file:///etc/passwd'>]><root>&test;</root>"
  ),

  // Large strings
  fc.string({ minLength: 10000, maxLength: 100000 }),

  // Unicode and encoding issues
  fc.constant('𝕏𝔗ℝÑŋ€'),
  fc.constant('%00%00%00'),
  fc.constant('\u0000\u0001\u0002'),

  // Empty and whitespace
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\n\r\t'),

  // Null bytes and control characters
  fc.string().filter(s => /[\x00-\x1F\x7F-\x9F]/.test(s))
);

/**
 * Generates malicious JSON payloads
 */
export const maliciousJson = fc.oneof(
  // Extremely nested objects (to cause stack overflow)
  fc.constant(
    JSON.stringify(
      Array(1000)
        .fill(0)
        .reduce(acc => ({ nested: acc }), {})
    )
  ),

  // Very large arrays
  fc.constant(JSON.stringify(Array(10000).fill('A'.repeat(1000)))),

  // Circular references (will cause JSON.stringify to fail)
  fc.constant('{"a": {"$ref": "#/a"}}'),

  // Prototype pollution attempts
  fc.constant('{"__proto__": {"isAdmin": true}}'),
  fc.constant('{"constructor": {"prototype": {"isAdmin": true}}}'),

  // Type confusion
  fc.constant('{"length": 4294967295}'),
  fc.constant('{"toString": "not a function"}'),

  // Invalid JSON
  fc.constant('{invalid json}'),
  fc.constant('{"unclosed": "string'),
  fc.constant('{"trailing": "comma",}')
);

/**
 * Generates boundary value test cases
 */
export const boundaryValues = {
  integers: fc.oneof(
    fc.constant(0),
    fc.constant(-1),
    fc.constant(1),
    fc.constant(Number.MAX_SAFE_INTEGER),
    fc.constant(Number.MIN_SAFE_INTEGER),
    fc.constant(2147483647), // MAX_INT32
    fc.constant(-2147483648) // MIN_INT32
  ),

  floats: fc.oneof(
    fc.constant(0.0),
    fc.constant(-0.0),
    fc.constant(Number.POSITIVE_INFINITY),
    fc.constant(Number.NEGATIVE_INFINITY),
    fc.constant(Number.NaN),
    fc.constant(Number.MAX_VALUE),
    fc.constant(Number.MIN_VALUE),
    fc.constant(Number.EPSILON)
  ),

  strings: fc.oneof(
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 1 }),
    fc.string({ minLength: 255, maxLength: 256 }),
    fc.string({ minLength: 65535, maxLength: 65536 }),
    fc.string({ minLength: 1048576, maxLength: 1048576 }) // 1MB
  ),

  arrays: fc.oneof(
    fc.constant([]),
    fc.array(fc.anything(), { minLength: 1, maxLength: 1 }),
    fc.array(fc.anything(), { minLength: 1000, maxLength: 1000 })
  ),
};

// ===== REQUEST FUZZING UTILITIES =====

/**
 * Generates fuzzed HTTP headers
 */
export const fuzzedHeaders = fc.dictionary(
  fc.oneof(
    // Standard headers
    fc.constantFrom(
      'content-type',
      'authorization',
      'user-agent',
      'accept',
      'content-length',
      'host',
      'origin',
      'referer'
    ),
    // Custom headers
    fc.string({ minLength: 1, maxLength: 50 })
  ),
  fc.oneof(
    fc.string({ minLength: 0, maxLength: 1000 }),
    maliciousStrings,
    boundaryValues.strings
  )
);

/**
 * Generates fuzzed query parameters
 */
export const fuzzedQuery = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 50 }),
  fc.oneof(
    fc.string({ minLength: 0, maxLength: 1000 }),
    maliciousStrings,
    boundaryValues.strings,
    boundaryValues.integers.map(String),
    boundaryValues.floats.map(String)
  )
);

/**
 * Generates fuzzed URL paths
 */
export const fuzzedPaths = fc.oneof(
  // Normal paths
  fc.string({ minLength: 1, maxLength: 100 }).map(s => `/${s}`),

  // Very long paths
  fc.string({ minLength: 8192, maxLength: 8192 }).map(s => `/${s}`),

  // Path traversal attempts
  fc.constant('/../../../etc/passwd'),
  fc.constant('/..\\..\\..\\windows\\system32'),

  // Encoded paths
  fc.constant('/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'),

  // Unicode normalization issues
  fc.constant('/\u{1F4A9}'), // Pile of poo emoji
  fc.constant('/caf\u00E9') // café with combining characters
);

// ===== FUZZING TEST DATA GENERATORS =====

/**
 * Generate test data for endpoint fuzzing
 */
export const fuzzingTestData = fc.record({
  headers: fuzzedHeaders,
  query: fuzzedQuery,
  body: fc.oneof(
    fc.anything(),
    maliciousJson.map(s => {
      try {
        return JSON.parse(s);
      } catch {
        return s;
      }
    }),
    maliciousStrings
  ),
});

/**
 * Configuration for API fuzzing tests
 */
export interface FuzzingTestConfig {
  iterations?: number;
  timeout?: number;
  expectedSuccessStatuses?: number[];
  expectedErrorStatuses?: number[];
}

/**
 * Security attack payload generators
 */
export const securityAttackPayloads = {
  sqlInjection: fc.constantFrom(
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin'--",
    "'; INSERT INTO users VALUES ('hacker', 'password'); --"
  ),

  xss: fc.constantFrom(
    "<script>alert('xss')</script>",
    "javascript:alert('xss')",
    "<img src=x onerror=alert('xss')>",
    "<svg onload=alert('xss')>"
  ),

  pathTraversal: fc.constantFrom(
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
  ),

  commandInjection: fc.constantFrom(
    '; cat /etc/passwd',
    '| ls -la',
    '$(whoami)',
    '`id`',
    '&& ping -c 1 127.0.0.1'
  ),

  prototypePollution: fc.constantFrom(
    '{"__proto__": {"isAdmin": true}}',
    '{"constructor": {"prototype": {"isAdmin": true}}}',
    '{"__proto__.isAdmin": true}'
  ),

  xxe: fc.constantFrom(
    "<?xml version='1.0'?><!DOCTYPE root [<!ENTITY test SYSTEM 'file:///etc/passwd'>]><root>&test;</root>",
    "<?xml version='1.0'?><!DOCTYPE root [<!ENTITY test SYSTEM 'http://attacker.com/'>]><root>&test;</root>"
  ),
};

// ===== MUTATION STRATEGIES =====

/**
 * Common payload mutation strategies for schema validation testing
 */
export const payloadMutationStrategies = {
  /**
   * Add unexpected fields
   */
  addUnexpectedFields: (
    payload: Record<string, unknown>
  ): Record<string, unknown> => ({
    ...payload,
    __proto__: { admin: true },
    unexpectedField: 'unexpected_value',
    constructor: { prototype: { admin: true } },
  }),

  /**
   * Remove required fields
   */
  removeRequiredFields: (
    payload: Record<string, unknown>
  ): Record<string, unknown> => {
    const mutated = { ...payload };
    const keys = Object.keys(mutated);
    if (keys.length > 0 && keys[0]) {
      delete mutated[keys[0]];
    }
    return mutated;
  },

  /**
   * Type confusion attacks
   */
  typeConfusion: (
    payload: Record<string, unknown>
  ): Record<string, unknown> => {
    const mutated = { ...payload };
    const keys = Object.keys(mutated);
    if (keys.length > 0 && keys[0]) {
      mutated[keys[0]] = 'string_instead_of_number';
    }
    return mutated;
  },

  /**
   * Boundary value injection
   */
  boundaryValues: (
    payload: Record<string, unknown>
  ): Record<string, unknown> => {
    const mutated = { ...payload };
    const keys = Object.keys(mutated);
    if (keys.length > 0 && keys[0]) {
      mutated[keys[0]] = Number.MAX_SAFE_INTEGER;
    }
    return mutated;
  },

  /**
   * Null/undefined injection
   */
  nullUndefinedInjection: (
    payload: Record<string, unknown>
  ): Record<string, unknown> => {
    const mutated = { ...payload };
    const keys = Object.keys(mutated);
    if (keys.length > 0 && keys[0]) {
      mutated[keys[0]] = Math.random() > 0.5 ? null : undefined;
    }
    return mutated;
  },
};

// ===== LOAD TESTING GENERATORS =====

/**
 * Generate concurrent request patterns for load testing
 */
export const loadTestPatterns = {
  /**
   * Burst pattern - many requests at once
   */
  burst: fc.array(
    fc.record({
      endpointIndex: fc.integer({ min: 0, max: 9 }),
      delay: fc.constant(0),
    }),
    { minLength: 50, maxLength: 100 }
  ),

  /**
   * Steady pattern - evenly distributed requests
   */
  steady: fc.array(
    fc.record({
      endpointIndex: fc.integer({ min: 0, max: 9 }),
      delay: fc.integer({ min: 100, max: 1000 }),
    }),
    { minLength: 20, maxLength: 50 }
  ),

  /**
   * Spike pattern - gradual increase then sudden spike
   */
  spike: fc.array(
    fc.record({
      endpointIndex: fc.integer({ min: 0, max: 9 }),
      delay: fc.oneof(
        fc.integer({ min: 1000, max: 2000 }),
        fc.integer({ min: 0, max: 10 })
      ),
    }),
    { minLength: 30, maxLength: 80 }
  ),
};

// ===== COMMON INVARIANTS FOR API TESTING =====

/**
 * Common invariants that should hold for all API endpoints
 */
export const apiInvariants = {
  /**
   * Response must have valid HTTP status code
   */
  validStatusCode: (statusCode: number): boolean =>
    statusCode >= 100 && statusCode < 600,

  /**
   * Response must not leak sensitive information
   */
  noSensitiveDataLeak: (responseBody: string): boolean => {
    const lowerBody = responseBody.toLowerCase();
    const sensitivePatterns = [
      /password/,
      /secret/,
      /key/,
      /token/,
      /private/,
      /stack trace/,
      /error:/,
      /exception:/,
    ];
    return !sensitivePatterns.some(pattern => pattern.test(lowerBody));
  },

  /**
   * Response must have proper content-type header
   */
  hasContentType: (headers: Record<string, string>): boolean =>
    'content-type' in headers || 'Content-Type' in headers,

  /**
   * Error responses should have proper structure
   */
  properErrorStructure: (statusCode: number, body: unknown): boolean => {
    if (statusCode >= 400) {
      if (typeof body === 'object' && body !== null) {
        const errorBody = body as Record<string, unknown>;
        return 'statusCode' in errorBody && 'error' in errorBody;
      }
      // Non-JSON error responses are acceptable
      return true;
    }
    return true;
  },

  /**
   * Server should not crash (no connection errors)
   */
  serverStability: (error: unknown): boolean => {
    if (error instanceof Error) {
      const crashIndicators = [
        'ECONNRESET',
        'ECONNREFUSED',
        'timeout',
        'socket hang up',
      ];
      return !crashIndicators.some(indicator =>
        error.message.includes(indicator)
      );
    }
    return true;
  },
};

// ===== EXAMPLE USAGE TEMPLATES =====

/**
 * Example test template for API endpoint fuzzing
 * Copy this to your test files and adapt as needed
 */
export const exampleFuzzingTest = `
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  fuzzingTestData,
  apiInvariants,
  securityAttackPayloads
} from '@airbolt/types';

describe('API Fuzzing Tests', () => {
  it('should handle malicious inputs safely', () => {
    fc.assert(
      fc.property(fuzzingTestData, async ({ headers, query, body }) => {
        const response = await app.inject({
          method: 'POST',
          url: '/users',
          headers,
          query,
          payload: body,
        });

        // Verify response invariants
        expect(apiInvariants.validStatusCode(response.statusCode)).toBe(true);
        expect(apiInvariants.noSensitiveDataLeak(response.payload)).toBe(true);
        expect(apiInvariants.hasContentType(response.headers)).toBe(true);
        expect(apiInvariants.properErrorStructure(response.statusCode, JSON.parse(response.payload || '{}'))).toBe(true);
      })
    );
  });

  it('should resist security attacks', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          securityAttackPayloads.sqlInjection,
          securityAttackPayloads.xss,
          securityAttackPayloads.pathTraversal
        ),
        async (maliciousPayload) => {
          const response = await app.inject({
            method: 'POST',
            url: '/search',
            payload: { query: maliciousPayload },
          });

          // Should not reflect malicious content
          expect(response.payload).not.toMatch(/<script>/);
          expect(response.payload).not.toMatch(/root:x:0:0:/);
          expect(response.payload).not.toMatch(/admin.*:.*:/);
        }
      )
    );
  });
});
`;

/**
 * Example model-based testing template
 */
export const exampleModelBasedTest = `
import { runModelBasedTest, shoppingCartStateMachine } from '@airbolt/types';

describe('Shopping Cart State Machine', () => {
  it('should maintain consistency across operations', async () => {
    await runModelBasedTest(
      shoppingCartStateMachine(() => new ShoppingCart()),
      { maxCommands: 50, iterations: 20 }
    );
  });
});
`;
