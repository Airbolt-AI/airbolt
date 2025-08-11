import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createHashKey,
  sanitizeUserId,
  sanitizeSessionId,
  extractIssuerSafely,
  validateTokenFormat,
} from './auth-utils.js';

describe('Auth utils property tests', () => {
  describe('createHashKey', () => {
    it('should always produce a hash for any input', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom('verification', 'cache', 'audit'),
          (input: string, purpose: string) => {
            const hash = createHashKey(input, purpose);
            return typeof hash === 'string' && hash.length > 0;
          }
        )
      );
    });

    it('should produce consistent hashes for same input', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom('verification', 'cache', 'audit'),
          (input: string, purpose: string) => {
            const hash1 = createHashKey(input, purpose);
            const hash2 = createHashKey(input, purpose);
            return hash1 === hash2;
          }
        )
      );
    });
  });

  describe('sanitizeUserId', () => {
    it('should always return a string for any input', () => {
      fc.assert(
        fc.property(fc.string(), (userId: string) => {
          const sanitized = sanitizeUserId(userId);
          return typeof sanitized === 'string';
        })
      );
    });

    it('should preserve valid user IDs unchanged', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          (validUserId: string) => {
            fc.pre(/^[a-zA-Z0-9._-]+$/.test(validUserId)); // Pre-condition: valid format
            const sanitized = sanitizeUserId(validUserId);
            return sanitized === validUserId;
          }
        )
      );
    });
  });

  describe('sanitizeSessionId', () => {
    it('should always return a string for any input', () => {
      fc.assert(
        fc.property(fc.string(), (sessionId: string) => {
          const sanitized = sanitizeSessionId(sessionId);
          return typeof sanitized === 'string';
        })
      );
    });

    it('should preserve valid session IDs unchanged', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (validSessionId: string) => {
            fc.pre(/^[a-zA-Z0-9._-]+$/.test(validSessionId)); // Pre-condition: valid format
            const sanitized = sanitizeSessionId(validSessionId);
            return sanitized === validSessionId;
          }
        )
      );
    });
  });

  describe('extractIssuerSafely', () => {
    it('should never throw for any input', () => {
      fc.assert(
        fc.property(fc.string(), (token: string) => {
          try {
            const issuer = extractIssuerSafely(token);
            return typeof issuer === 'string';
          } catch {
            return false; // Should never throw
          }
        })
      );
    });

    it('should return "unknown" for invalid tokens', () => {
      fc.assert(
        fc.property(fc.string(), (invalidToken: string) => {
          fc.pre(!invalidToken.includes('.')); // Pre-condition: not JWT format
          const issuer = extractIssuerSafely(invalidToken);
          return issuer === 'unknown';
        })
      );
    });
  });

  describe('validateTokenFormat', () => {
    it('should return boolean for any input', () => {
      fc.assert(
        fc.property(fc.string(), (token: string) => {
          const isValid = validateTokenFormat(token);
          return typeof isValid === 'boolean';
        })
      );
    });

    it('should return true for three-part dot-separated tokens', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // Header
          fc.string({ minLength: 1 }), // Payload
          fc.string({ minLength: 1 }), // Signature
          (header: string, payload: string, signature: string) => {
            const token = `${header}.${payload}.${signature}`;
            const isValid = validateTokenFormat(token);
            expect(isValid).toBe(true);
            return true;
          }
        )
      );
    });

    it('should return false for strings without exactly 2 dots', () => {
      fc.assert(
        fc.property(fc.string(), (token: string) => {
          fc.pre((token.match(/\./g) || []).length !== 2); // Pre-condition: not exactly 2 dots
          const isValid = validateTokenFormat(token);
          expect(isValid).toBe(false);
          return true;
        })
      );
    });
  });
});
