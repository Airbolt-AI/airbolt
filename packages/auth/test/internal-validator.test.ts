import { describe, it, expect, vi, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { InternalJWTValidator } from '../src/validators/internal.js';

describe('InternalJWTValidator', () => {
  let mockFastify: FastifyInstance;
  let validator: InternalJWTValidator;
  const testSecret = 'test-secret';

  beforeEach(() => {
    mockFastify = {
      jwt: {
        verify: vi.fn(),
      },
    } as any;
    validator = new InternalJWTValidator(mockFastify);
  });

  describe('canHandle', () => {
    it('should handle tokens with airbolt-api issuer', () => {
      const token = jwt.sign({ iss: 'airbolt-api' }, testSecret);
      expect(validator.canHandle(token)).toBe(true);
    });

    test.prop([
      fc
        .string({ minLength: 1, maxLength: 50 })
        .filter(s => s !== 'airbolt-api'),
    ])('should reject tokens with any non-airbolt-api issuer', issuer => {
      const token = jwt.sign({ iss: issuer }, testSecret);
      expect(validator.canHandle(token)).toBe(false);
    });

    test.prop([
      fc.record(
        {
          sub: fc.option(fc.string(), { nil: undefined }),
          someOtherClaim: fc.option(fc.string(), { nil: undefined }),
          // Deliberately exclude 'iss' to test tokens without issuer
        },
        { requiredKeys: [] }
      ),
    ])(
      'should reject tokens without issuer regardless of other claims',
      payload => {
        // Filter out undefined values to avoid JWT library issues
        const cleanPayload = Object.fromEntries(
          Object.entries(payload).filter(([, value]) => value !== undefined)
        );
        const token = jwt.sign(cleanPayload, testSecret);
        expect(validator.canHandle(token)).toBe(false);
      }
    );

    test.prop([
      fc.oneof(
        fc.constant(''),
        fc.constant('not-a-jwt'),
        fc.string({ maxLength: 10 }), // Too short for JWT
        fc.string().filter(s => !s.includes('.')), // No JWT structure
        fc.string().map(s => s.replace(/\./g, 'x')) // Corrupt JWT structure
      ),
    ])('should handle any malformed token gracefully', malformedToken => {
      expect(validator.canHandle(malformedToken)).toBe(false);
    });
  });

  describe('verify', () => {
    it('should verify token using fastify jwt', async () => {
      const token = 'test-token';
      const payload = { userId: 'user-123', iss: 'airbolt-api' };

      mockFastify.jwt.verify = vi.fn().mockResolvedValue(payload);

      const result = await validator.verify(token);

      expect(mockFastify.jwt.verify).toHaveBeenCalledWith(token);
      expect(result).toEqual(payload);
    });

    it('should propagate verification errors', async () => {
      const token = 'invalid-token';
      const error = new Error('Invalid signature');

      mockFastify.jwt.verify = vi.fn().mockRejectedValue(error);

      await expect(validator.verify(token)).rejects.toThrow(error);
    });
  });

  describe('extractUserId', () => {
    test.prop([
      fc
        .string({ minLength: 1, maxLength: 100 })
        .filter(s => s.trim().length > 0), // Non-empty after trim
    ])('should extract any valid userId from payload', userId => {
      const result = validator.extractUserId({ userId });
      expect(result).toBe(userId);
    });

    test.prop([
      fc.record(
        {
          // Various other fields but no userId
          sub: fc.option(fc.string(), { nil: undefined }),
          email: fc.option(fc.string(), { nil: undefined }),
          name: fc.option(fc.string(), { nil: undefined }),
          exp: fc.option(fc.integer(), { nil: undefined }),
          iat: fc.option(fc.integer(), { nil: undefined }),
        },
        { requiredKeys: [] }
      ),
    ])('should return anonymous for payload without userId', payload => {
      // Filter out undefined values for TypeScript compatibility
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      ) as any;
      const result = validator.extractUserId(cleanPayload);
      expect(result).toBe('anonymous');
    });

    test.prop([
      fc.oneof(
        fc.constant(null as any),
        fc.constant(undefined as any),
        fc.constant('')
        // Note: whitespace-only strings are treated as truthy by the || operator
        // so they won't return 'anonymous'. This tests the actual behavior.
      ),
    ])('should return anonymous for falsy userId values', invalidUserId => {
      const result = validator.extractUserId({ userId: invalidUserId });
      expect(result).toBe('anonymous');
    });

    test.prop([
      fc.oneof(
        fc.constant(' '), // Whitespace only
        fc.constant('\t\n'), // Various whitespace chars
        fc.constant('   ') // Multiple spaces
      ),
    ])(
      'should return whitespace strings as-is (not convert to anonymous)',
      whitespaceUserId => {
        const result = validator.extractUserId({ userId: whitespaceUserId });
        expect(result).toBe(whitespaceUserId); // Actual behavior: truthy strings are returned
      }
    );
  });
});
