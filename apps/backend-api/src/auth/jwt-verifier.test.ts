import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import { createRemoteJWKSet } from 'jose';
import {
  isDevelopmentMode,
  generateDevelopmentToken,
  verifyJWT,
} from './jwt-verifier.js';
import { jwksCache } from './jwks-cache.js';
import { validateIssuerBeforeNetwork } from './issuer-validator.js';

// Mock dependencies
vi.mock('./jwks-cache.js', () => ({
  jwksCache: {
    getOrCreate: vi.fn(),
  },
}));

vi.mock('./issuer-validator.js', () => ({
  validateIssuerBeforeNetwork: vi.fn(),
}));

vi.mock('jose', async () => {
  const actual = await vi.importActual('jose');
  return {
    ...actual,
    jwtVerify: vi.fn(),
    createRemoteJWKSet: vi.fn(),
  };
});

const { jwtVerify } = await import('jose');

describe('Development Mode', () => {
  let originalNodeEnv: string | undefined;
  let originalAuthRequired: string | undefined;
  let originalJwtSecret: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env['NODE_ENV'];
    originalAuthRequired = process.env['AUTH_REQUIRED'];
    originalJwtSecret = process.env['JWT_SECRET'];
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalNodeEnv;
    process.env['AUTH_REQUIRED'] = originalAuthRequired;
    process.env['JWT_SECRET'] = originalJwtSecret;
  });

  describe('isDevelopmentMode', () => {
    it('should return true in development mode without AUTH_REQUIRED', () => {
      process.env['NODE_ENV'] = 'development';
      delete process.env['AUTH_REQUIRED'];

      expect(isDevelopmentMode()).toBe(true);
    });

    it('should return true when NODE_ENV is undefined (defaults to dev)', () => {
      delete process.env['NODE_ENV'];
      delete process.env['AUTH_REQUIRED'];

      expect(isDevelopmentMode()).toBe(true);
    });

    it('should return true in test mode without AUTH_REQUIRED', () => {
      process.env['NODE_ENV'] = 'test';
      delete process.env['AUTH_REQUIRED'];

      expect(isDevelopmentMode()).toBe(true);
    });

    it('should return false in production mode', () => {
      process.env['NODE_ENV'] = 'production';
      delete process.env['AUTH_REQUIRED'];

      expect(isDevelopmentMode()).toBe(false);
    });

    it('should return false when AUTH_REQUIRED is set to true', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['AUTH_REQUIRED'] = 'true';

      expect(isDevelopmentMode()).toBe(false);
    });

    it('should return false when AUTH_REQUIRED is set to any truthy value', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['AUTH_REQUIRED'] = '1';

      expect(isDevelopmentMode()).toBe(false);
    });

    it('should return false when AUTH_REQUIRED is set to false string', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['AUTH_REQUIRED'] = 'false';

      expect(isDevelopmentMode()).toBe(false);
    });
  });

  describe('generateDevelopmentToken', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'development';
      delete process.env['AUTH_REQUIRED'];
    });

    it('should generate valid development tokens with correct claims', () => {
      const identifier = 'test-ip';
      const token = generateDevelopmentToken(identifier);

      expect(token).toBeTypeOf('string');
      expect(token.length).toBeGreaterThan(0);

      const decoded = jwt.decode(token) as any;
      expect(decoded).toMatchObject({
        sub: 'dev-user-test-ip',
        email: 'dev-test-ip@localhost',
        iss: 'airbolt-development',
        iat: expect.any(Number),
        exp: expect.any(Number),
      });

      // Verify token expires in 10 minutes (600 seconds)
      expect(decoded.exp - decoded.iat).toBe(600);
    });

    it('should use custom JWT_SECRET when provided', () => {
      const customSecret = 'test-secret-key-for-validation';
      process.env['JWT_SECRET'] = customSecret;

      const identifier = 'test-user';
      const token = generateDevelopmentToken(identifier);

      // Should be able to verify with the custom secret
      expect(() => jwt.verify(token, customSecret)).not.toThrow();
    });

    it('should use default secret when JWT_SECRET is not provided', () => {
      delete process.env['JWT_SECRET'];

      const identifier = 'test-user';
      const token = generateDevelopmentToken(identifier);

      // Should be able to verify with the default secret
      expect(() =>
        jwt.verify(token, 'dev-secret-do-not-use-in-production')
      ).not.toThrow();
    });

    it('should generate unique tokens for different identifiers', () => {
      const token1 = generateDevelopmentToken('user1');
      const token2 = generateDevelopmentToken('user2');

      expect(token1).not.toBe(token2);

      const decoded1 = jwt.decode(token1) as any;
      const decoded2 = jwt.decode(token2) as any;

      expect(decoded1.sub).toBe('dev-user-user1');
      expect(decoded2.sub).toBe('dev-user-user2');
      expect(decoded1.email).toBe('dev-user1@localhost');
      expect(decoded2.email).toBe('dev-user2@localhost');
    });

    it('should generate different tokens for same identifier at different times', async () => {
      const identifier = 'same-user';
      const token1 = generateDevelopmentToken(identifier);

      // Wait enough time to ensure different iat (1 second resolution)
      await new Promise(resolve => setTimeout(resolve, 1001));

      const token2 = generateDevelopmentToken(identifier);

      expect(token1).not.toBe(token2);

      const decoded1 = jwt.decode(token1) as any;
      const decoded2 = jwt.decode(token2) as any;

      // Same claims except for timing
      expect(decoded1.sub).toBe(decoded2.sub);
      expect(decoded1.email).toBe(decoded2.email);
      expect(decoded1.iss).toBe(decoded2.iss);
      expect(decoded1.iat).toBeLessThan(decoded2.iat);
    });

    it('should throw error in production mode', () => {
      process.env['NODE_ENV'] = 'production';

      expect(() => generateDevelopmentToken('test')).toThrow(
        'Development tokens only available in dev mode'
      );
    });

    it('should throw error when AUTH_REQUIRED is set', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['AUTH_REQUIRED'] = 'true';

      expect(() => generateDevelopmentToken('test')).toThrow(
        'Development tokens only available in dev mode'
      );
    });

    it('should throw error for empty identifier', () => {
      expect(() => generateDevelopmentToken('')).toThrow(
        'Identifier is required for development token'
      );
    });

    it('should throw error for whitespace-only identifier', () => {
      expect(() => generateDevelopmentToken('   ')).toThrow(
        'Identifier is required for development token'
      );
    });

    it('should throw error for null/undefined identifier', () => {
      expect(() => generateDevelopmentToken(null as any)).toThrow(
        'Identifier is required for development token'
      );

      expect(() => generateDevelopmentToken(undefined as any)).toThrow(
        'Identifier is required for development token'
      );
    });

    it('should handle special characters in identifier', () => {
      const identifiers = [
        '192.168.1.1',
        'user@domain.com',
        'test-user_123',
        'special!@#$%^&*()',
      ];

      identifiers.forEach(identifier => {
        const token = generateDevelopmentToken(identifier);
        const decoded = jwt.decode(token) as any;

        expect(decoded.sub).toBe(`dev-user-${identifier}`);
        expect(decoded.email).toBe(`dev-${identifier}@localhost`);
      });
    });

    it('should generate tokens with proper expiration time', () => {
      const beforeGeneration = Math.floor(Date.now() / 1000);
      const token = generateDevelopmentToken('test');
      const afterGeneration = Math.floor(Date.now() / 1000);

      const decoded = jwt.decode(token) as any;

      // iat should be between before and after generation
      expect(decoded.iat).toBeGreaterThanOrEqual(beforeGeneration);
      expect(decoded.iat).toBeLessThanOrEqual(afterGeneration);

      // exp should be exactly 10 minutes (600 seconds) after iat
      expect(decoded.exp).toBe(decoded.iat + 600);

      // Token should not be expired immediately
      expect(decoded.exp).toBeGreaterThan(afterGeneration);
    });
  });
});

describe('JWT Verification Property Tests', () => {
  const mockJwksCache = vi.mocked(jwksCache);
  const mockValidateIssuer = vi.mocked(validateIssuerBeforeNetwork);
  const mockJwtVerify = vi.mocked(jwtVerify);
  const mockCreateRemoteJWKSet = vi.mocked(createRemoteJWKSet);

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwksCache.getOrCreate.mockReturnValue(mockCreateRemoteJWKSet as any);
    mockValidateIssuer.mockImplementation(() => {}); // No-op by default
  });

  describe('Token format validation', () => {
    it('rejects any malformed JWT token structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Invalid number of parts
            fc.string().filter(s => s.split('.').length !== 3),
            // Empty parts
            fc.constantFrom('..', '.payload.', 'header..', ''),
            // Non-base64 characters in payload
            fc
              .tuple(
                fc.base64String(),
                fc.string().filter(s => !/^[A-Za-z0-9_-]*$/.test(s)),
                fc.base64String()
              )
              .map(([h, p, s]) => `${h}.${p}.${s}`),
            // Single dots
            fc.constantFrom('.', '..', '...', '....'),
            // Only whitespace
            fc
              .string({ minLength: 1, maxLength: 10 })
              .filter(s => s.trim() === ''),
            // Non-string input (as string representation)
            fc.constantFrom('null', 'undefined', '{}', '[]')
          ),
          async malformedToken => {
            await expect(verifyJWT(malformedToken)).rejects.toThrow(
              /Invalid token/
            );

            // Should not make any network calls for malformed tokens
            expect(mockJwksCache.getOrCreate).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('rejects tokens with valid format but invalid JSON payload', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            header: fc.base64String(),
            invalidJson: fc.oneof(
              fc.constant('not-json'),
              fc.constant('{invalid'),
              fc.constant('undefined'),
              fc.constant('')
            ),
            signature: fc.base64String(),
          }),
          async ({ header, invalidJson, signature }) => {
            const malformedToken = `${header}.${Buffer.from(invalidJson).toString('base64url')}.${signature}`;

            await expect(verifyJWT(malformedToken)).rejects.toThrow(
              'Invalid token format: unable to parse JWT structure'
            );

            expect(mockJwksCache.getOrCreate).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('validates token input types properly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .oneof(
              fc.constant(null),
              fc.constant(undefined),
              fc.constant(''),
              fc.string().filter(s => s.trim() === ''),
              fc.integer(),
              fc.boolean(),
              fc.array(fc.string()),
              fc.object()
            )
            .map(v => v as any),
          async invalidInput => {
            await expect(verifyJWT(invalidInput)).rejects.toThrow(
              'Invalid token: must be a non-empty string'
            );

            expect(mockJwksCache.getOrCreate).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Issuer validation', () => {
    it('rejects tokens with missing or invalid issuer claims', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Missing issuer
            fc.record({ sub: fc.string(), exp: fc.integer() }),
            // Invalid issuer types
            fc.record({
              iss: fc.oneof(
                fc.integer(),
                fc.boolean(),
                fc.array(fc.string()),
                fc.object()
              ),
              sub: fc.string(),
            }),
            // Empty string issuer
            fc.record({ iss: fc.constant(''), sub: fc.string() })
          ),
          async payload => {
            const header = Buffer.from(
              JSON.stringify({ alg: 'RS256' })
            ).toString('base64url');
            const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
              'base64url'
            );
            const signature =
              Buffer.from('fake-signature').toString('base64url');
            const token = `${header}.${payloadB64}.${signature}`;

            await expect(verifyJWT(token)).rejects.toThrow(
              'Invalid token: missing or invalid issuer claim'
            );

            expect(mockValidateIssuer).not.toHaveBeenCalled();
            expect(mockJwksCache.getOrCreate).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('passes issuer to validation and propagates validation errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            iss: fc.webUrl(),
            sub: fc.string({ minLength: 1 }),
            exp: fc.integer({ min: 1000000000 }),
          }),
          fc.string({ minLength: 1, maxLength: 100 }), // error message
          async (payload, errorMessage) => {
            const header = Buffer.from(
              JSON.stringify({ alg: 'RS256' })
            ).toString('base64url');
            const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
              'base64url'
            );
            const signature =
              Buffer.from('fake-signature').toString('base64url');
            const token = `${header}.${payloadB64}.${signature}`;

            mockValidateIssuer.mockImplementation(() => {
              throw new Error(errorMessage);
            });

            await expect(verifyJWT(token)).rejects.toThrow(
              `Token verification failed: ${errorMessage}`
            );

            expect(mockValidateIssuer).toHaveBeenCalledWith(
              payload.iss,
              undefined
            );
            expect(mockJwksCache.getOrCreate).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('handles custom issuer validation correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            iss: fc.webUrl(),
            sub: fc.string({ minLength: 1 }),
            exp: fc.integer({ min: 1000000000 }),
          }),
          fc.webUrl(), // custom issuer
          async (payload, customIssuer) => {
            const header = Buffer.from(
              JSON.stringify({ alg: 'RS256' })
            ).toString('base64url');
            const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
              'base64url'
            );
            const signature =
              Buffer.from('fake-signature').toString('base64url');
            const token = `${header}.${payloadB64}.${signature}`;

            mockValidateIssuer.mockImplementation(() => {
              throw new Error('Validation failed for custom issuer test');
            });

            await expect(verifyJWT(token, customIssuer)).rejects.toThrow();

            expect(mockValidateIssuer).toHaveBeenCalledWith(
              payload.iss,
              customIssuer
            );
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  describe('JWKS cache integration', () => {
    it('properly handles JWKS cache errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            iss: fc.constantFrom(
              'https://example.clerk.accounts.dev',
              'https://example.auth0.com',
              'https://securetoken.google.com/project-id'
            ),
            sub: fc.string({ minLength: 1 }),
            exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 60 }),
          }),
          async payload => {
            const header = Buffer.from(
              JSON.stringify({ alg: 'RS256' })
            ).toString('base64url');
            const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
              'base64url'
            );
            const signature =
              Buffer.from('fake-signature').toString('base64url');
            const token = `${header}.${payloadB64}.${signature}`;

            mockJwksCache.getOrCreate.mockImplementation(() => {
              throw new Error('JWKS cache error');
            });

            await expect(verifyJWT(token)).rejects.toThrow(
              'Unable to retrieve signing keys for token verification'
            );

            expect(mockJwksCache.getOrCreate).toHaveBeenCalledWith(payload.iss);
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  describe('JWT signature verification', () => {
    it('handles various jose verification failures correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            iss: fc.constantFrom(
              'https://example.clerk.accounts.dev',
              'https://example.auth0.com'
            ),
            sub: fc.string({ minLength: 1 }),
            exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 60 }),
          }),
          fc.constantFrom(
            'expired',
            'signature verification failed',
            'audience validation failed',
            'issuer validation failed',
            'token is not yet valid (before)',
            'unknown error'
          ),
          async (payload, errorType) => {
            const header = Buffer.from(
              JSON.stringify({ alg: 'RS256' })
            ).toString('base64url');
            const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
              'base64url'
            );
            const signature =
              Buffer.from('fake-signature').toString('base64url');
            const token = `${header}.${payloadB64}.${signature}`;

            const joseError = new Error(`JWT ${errorType}`);
            mockJwtVerify.mockRejectedValue(joseError);

            await expect(verifyJWT(token)).rejects.toThrow();

            const thrownError = await verifyJWT(token).catch(e => e);

            // Verify specific error mappings
            if (errorType.includes('expired')) {
              expect(thrownError.message).toBe('Token has expired');
            } else if (errorType.includes('signature')) {
              expect(thrownError.message).toBe(
                'Token signature verification failed'
              );
            } else if (errorType.includes('audience')) {
              expect(thrownError.message).toBe(
                'Token audience validation failed'
              );
            } else if (errorType.includes('issuer')) {
              expect(thrownError.message).toBe(
                'Token issuer validation failed'
              );
            } else if (errorType.includes('before')) {
              expect(thrownError.message).toBe('Token is not yet valid');
            } else {
              expect(thrownError.message).toBe('Token verification failed');
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('handles non-Error exceptions from jose', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            iss: fc.constantFrom('https://example.clerk.accounts.dev'),
            sub: fc.string({ minLength: 1 }),
            exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 60 }),
          }),
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.object(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          async (payload, nonErrorException) => {
            const header = Buffer.from(
              JSON.stringify({ alg: 'RS256' })
            ).toString('base64url');
            const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
              'base64url'
            );
            const signature =
              Buffer.from('fake-signature').toString('base64url');
            const token = `${header}.${payloadB64}.${signature}`;

            mockJwtVerify.mockRejectedValue(nonErrorException);

            await expect(verifyJWT(token)).rejects.toThrow(
              'Token verification failed due to unknown error'
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    it('successfully verifies valid tokens and returns correct claims', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.string({ minLength: 1 }),
            iss: fc.constantFrom('https://example.clerk.accounts.dev'),
            exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 60 }),
            iat: fc.integer({ min: Math.floor(Date.now() / 1000) - 3600 }),
            email: fc.option(fc.emailAddress()),
            aud: fc.option(fc.oneof(fc.string(), fc.array(fc.string()))),
          }),
          async payload => {
            const header = Buffer.from(
              JSON.stringify({ alg: 'RS256' })
            ).toString('base64url');
            const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
              'base64url'
            );
            const signature =
              Buffer.from('fake-signature').toString('base64url');
            const token = `${header}.${payloadB64}.${signature}`;

            // Mock successful verification
            mockJwtVerify.mockResolvedValue({
              payload: payload as any,
              protectedHeader: { alg: 'RS256' },
              key: {} as any,
            });

            const result = await verifyJWT(token);

            expect(result).toMatchObject({
              sub: payload.sub,
              iss: payload.iss,
              exp: payload.exp,
              iat: payload.iat,
            });

            if (payload.email) {
              expect(result.email).toBe(payload.email);
            }

            if (payload.aud) {
              expect(result.aud).toEqual(payload.aud);
            }

            expect(mockJwtVerify).toHaveBeenCalledWith(
              token,
              expect.any(Function),
              {
                issuer: payload.iss,
                clockTolerance: 5,
              }
            );
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Clock skew and expiration edge cases', () => {
    it('handles tokens near expiration boundary', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: -10, max: 10 }), // seconds from now
          async offsetSeconds => {
            const now = Math.floor(Date.now() / 1000);
            const payload = {
              sub: 'test-user',
              iss: 'https://example.clerk.accounts.dev',
              iat: now - 3600,
              exp: now + offsetSeconds,
            };

            const header = Buffer.from(
              JSON.stringify({ alg: 'RS256' })
            ).toString('base64url');
            const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
              'base64url'
            );
            const signature =
              Buffer.from('fake-signature').toString('base64url');
            const token = `${header}.${payloadB64}.${signature}`;

            if (offsetSeconds <= -5) {
              // Token is expired beyond clock tolerance
              mockJwtVerify.mockRejectedValue(new Error('JWT expired'));
              await expect(verifyJWT(token)).rejects.toThrow(
                'Token has expired'
              );
            } else {
              // Token is within tolerance or valid
              mockJwtVerify.mockResolvedValue({
                payload: payload as any,
                protectedHeader: { alg: 'RS256' },
                key: {} as any,
              });

              const result = await verifyJWT(token);
              expect(result).toMatchObject(payload);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Edge cases and error conditions', () => {
    it('preserves additional claims in verified tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sub: fc.string({ minLength: 1 }),
            iss: fc.constantFrom('https://example.auth0.com'),
            exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 60 }),
            iat: fc.integer({ min: Math.floor(Date.now() / 1000) - 3600 }),
            // Additional custom claims
            customClaim: fc.string(),
            numericClaim: fc.integer(),
            booleanClaim: fc.boolean(),
          }),
          async payload => {
            const header = Buffer.from(
              JSON.stringify({ alg: 'RS256' })
            ).toString('base64url');
            const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
              'base64url'
            );
            const signature =
              Buffer.from('fake-signature').toString('base64url');
            const token = `${header}.${payloadB64}.${signature}`;

            mockJwtVerify.mockResolvedValue({
              payload: payload as any,
              protectedHeader: { alg: 'RS256' },
              key: {} as any,
            });

            const result = await verifyJWT(token);

            // Standard claims
            expect(result.sub).toBe(payload.sub);
            expect(result.iss).toBe(payload.iss);
            expect(result.exp).toBe(payload.exp);
            expect(result.iat).toBe(payload.iat);

            // Custom claims should be preserved
            expect((result as any).customClaim).toBe(payload.customClaim);
            expect((result as any).numericClaim).toBe(payload.numericClaim);
            expect((result as any).booleanClaim).toBe(payload.booleanClaim);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('handles various base64url decoding edge cases', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Invalid base64url padding
            fc.tuple(
              fc.base64String(),
              fc.constantFrom('=', '==', '==='),
              fc.base64String()
            ),
            // Non-base64url characters
            fc.tuple(
              fc.base64String(),
              fc.string().filter(s => s.includes('+') || s.includes('/')),
              fc.base64String()
            ),
            // Extremely long payloads
            fc.tuple(
              fc.base64String(),
              fc.string({ minLength: 10000, maxLength: 50000 }),
              fc.base64String()
            )
          ),
          async ([header, payload, signature]) => {
            const token = `${header}.${payload}.${signature}`;

            await expect(verifyJWT(token)).rejects.toThrow(/Invalid token/);
            expect(mockJwksCache.getOrCreate).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});
