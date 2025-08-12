import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { test } from '@fast-check/vitest';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';

// Mock the JWKS utils BEFORE importing anything that uses them
vi.mock('../src/utils/jwks-utils.js', () => ({
  JWKSUtils: {
    fetchJWKS: vi.fn(),
    findKey: vi.fn(),
    extractPublicKey: vi.fn(),
  },
}));

import { ExternalJWTValidator } from '../src/validators/external.js';
import type { AuthConfig, JWTPayload } from '../src/types.js';
import { AuthError } from '../src/types.js';

describe.skip('ExternalJWTValidator - Secret Key Validation', () => {
  let validator: ExternalJWTValidator;
  let mockConfig: AuthConfig;
  let mockTokenValidator: any;
  let mockPolicy: any;

  // Test secrets with various formats
  const testSecrets = {
    simple: 'simple-secret-key-for-testing-purposes-must-be-long-enough',
    base64:
      'dGVzdC1zZWNyZXQta2V5LWZvci10ZXN0aW5nLXB1cnBvc2VzLW11c3QtYmUtbG9uZy1lbm91Z2g=',
    complex: 'complex!@#$%^&*()_+-={}[]|\\:";\'<>?,./secret123',
    unicode: 'sécret-kéy-with-ünïcödé-cháracters-2024',
  };

  beforeEach(() => {
    mockConfig = {
      NODE_ENV: 'development',
      EXTERNAL_JWT_SECRET: testSecrets.simple,
    };
    validator = new ExternalJWTValidator(mockConfig);

    // Setup token validator mock
    mockTokenValidator = {
      decode: vi.fn(),
      verify: vi.fn(),
      extractUserId: vi.fn().mockReturnValue('user_123'),
    };
    (validator as any).tokenValidator = mockTokenValidator;

    // Setup policy mock
    mockPolicy = {
      canHandleIssuer: vi.fn().mockReturnValue(true),
      validateIssuer: vi.fn(),
      validateAudience: vi.fn(),
      validateClaims: vi.fn(),
    };
    (validator as any).policy = mockPolicy;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('canHandle - Token Compatibility Detection', () => {
    // Property-based test for HTTPS issuer validation
    test.prop([fc.webUrl({ validSchemes: ['https'] })])(
      'should handle tokens from HTTPS issuers when policy allows',
      httpsIssuer => {
        const payload = {
          sub: 'user_123',
          iss: httpsIssuer,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        mockTokenValidator.decode.mockReturnValue({
          header: { alg: 'HS256' },
          payload: payload,
          signature: 'mock-signature',
        });

        const token = jwt.sign(payload, testSecrets.simple, {
          algorithm: 'HS256',
        });
        expect(validator.canHandle(token)).toBe(true);
      }
    );

    // Property-based test for various algorithms
    test.prop([
      fc.webUrl({ validSchemes: ['https'] }),
      fc.constantFrom('HS256', 'HS384', 'HS512'), // HMAC algorithms
    ])('should handle HMAC-signed tokens', (issuer, algorithm) => {
      const payload = {
        sub: 'user_123',
        iss: issuer,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockTokenValidator.decode.mockReturnValue({
        header: { alg: algorithm },
        payload: payload,
        signature: 'mock-signature',
      });

      const token = jwt.sign(payload, testSecrets.simple, {
        algorithm: algorithm as any,
      });
      expect(validator.canHandle(token)).toBe(true);
    });

    // Test rejection based on policy
    test.prop([
      fc.oneof(
        fc.webUrl({ validSchemes: ['http'] }), // Non-HTTPS
        fc.string().filter(s => !s.startsWith('https://')) // Invalid format
      ),
    ])('should reject tokens when policy rejects issuer', invalidIssuer => {
      const payload = {
        sub: 'user_123',
        iss: invalidIssuer,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockTokenValidator.decode.mockReturnValue({
        header: { alg: 'HS256' },
        payload: payload,
        signature: 'mock-signature',
      });

      mockPolicy.canHandleIssuer.mockReturnValue(false);

      const token = jwt.sign(payload, testSecrets.simple);
      expect(validator.canHandle(token)).toBe(false);
    });

    // Test malformed token handling
    test.prop([
      fc.oneof(
        fc.constant(''),
        fc.constant('not-a-jwt'),
        fc.string({ maxLength: 10 }), // Too short
        fc.string().filter(s => !s.includes('.')), // No JWT structure
        fc.string().map(s => s.replace(/\./g, 'x')) // Corrupt structure
      ),
    ])('should handle malformed tokens gracefully', malformedToken => {
      mockTokenValidator.decode.mockImplementation(() => {
        throw new Error('Invalid token format');
      });

      expect(validator.canHandle(malformedToken)).toBe(false);
    });

    // Test tokens without issuer
    test.prop([
      fc.record(
        {
          sub: fc.string({ minLength: 1 }),
          aud: fc.option(fc.string()),
          exp: fc.integer({
            min: Math.floor(Date.now() / 1000),
            max: Math.floor(Date.now() / 1000) + 7200,
          }),
          // Deliberately exclude 'iss'
        },
        { requiredKeys: ['sub'] }
      ),
    ])(
      'should handle tokens without issuer based on policy',
      payloadWithoutIss => {
        mockTokenValidator.decode.mockReturnValue({
          header: { alg: 'HS256' },
          payload: payloadWithoutIss,
          signature: 'mock-signature',
        });

        // Policy decides whether to handle tokens without issuer
        const shouldHandle = Math.random() > 0.5;
        mockPolicy.canHandleIssuer.mockReturnValue(shouldHandle);

        const token = jwt.sign(payloadWithoutIss, testSecrets.simple);
        expect(validator.canHandle(token)).toBe(shouldHandle);
      }
    );
  });

  describe('verify - Secret Key Validation', () => {
    // Property-based test for successful verification with various secrets
    test.prop([
      fc.oneof(
        fc.string({ minLength: 32, maxLength: 128 }), // Simple secrets
        fc
          .string({ minLength: 32, maxLength: 128 })
          .map(s => Buffer.from(s).toString('base64')), // Base64
        fc
          .string({ minLength: 32, maxLength: 128 })
          .filter(s => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(s)) // Special chars
      ),
      fc.webUrl({ validSchemes: ['https'] }),
      fc.string({ minLength: 5, maxLength: 50 }),
    ])(
      'should successfully verify tokens with valid secrets',
      async (secret, issuer, userId) => {
        // Update config with new secret
        const configWithSecret = { ...mockConfig, EXTERNAL_JWT_SECRET: secret };
        validator = new ExternalJWTValidator(configWithSecret);
        (validator as any).tokenValidator = mockTokenValidator;
        (validator as any).policy = mockPolicy;

        const payload: JWTPayload = {
          sub: userId,
          iss: issuer,
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        };

        const token = jwt.sign(payload, secret, { algorithm: 'HS256' });

        mockTokenValidator.verify.mockResolvedValue(payload);

        const result = await validator.verify(token);

        expect(result).toEqual(payload);
        expect(mockTokenValidator.verify).toHaveBeenCalledWith(token, secret);
        expect(mockPolicy.validateIssuer).toHaveBeenCalledWith(issuer);
        expect(mockPolicy.validateAudience).toHaveBeenCalledWith(payload);
        expect(mockPolicy.validateClaims).toHaveBeenCalledWith(payload);
      }
    );

    // Test missing secret configuration
    it('should throw AuthError when secret not configured', async () => {
      const configWithoutSecret = { ...mockConfig };
      delete configWithoutSecret.EXTERNAL_JWT_SECRET;
      validator = new ExternalJWTValidator(configWithoutSecret);

      const payload: JWTPayload = {
        sub: 'user_123',
        iss: 'https://example.com/',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, 'any-secret');

      await expect(validator.verify(token)).rejects.toThrow(AuthError);
      await expect(validator.verify(token)).rejects.toThrow(
        'EXTERNAL_JWT_SECRET not configured'
      );
    });

    // Test empty secret configuration
    it('should throw AuthError when secret is empty string', async () => {
      const configWithEmptySecret = { ...mockConfig, EXTERNAL_JWT_SECRET: '' };
      validator = new ExternalJWTValidator(configWithEmptySecret);

      const payload: JWTPayload = {
        sub: 'user_123',
        iss: 'https://example.com/',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, 'any-secret');

      await expect(validator.verify(token)).rejects.toThrow(AuthError);
      await expect(validator.verify(token)).rejects.toThrow(
        'EXTERNAL_JWT_SECRET not configured'
      );
    });

    // Test whitespace secrets (these are considered valid by the validator but will fail JWT verification)
    test.prop([
      fc.oneof(
        fc.constant('   '), // Whitespace only
        fc.constant('\t\n') // Various whitespace
      ),
    ])(
      'should handle whitespace-only secrets as JWT verification failures',
      async whitespaceSecret => {
        const configWithWhitespaceSecret = {
          ...mockConfig,
          EXTERNAL_JWT_SECRET: whitespaceSecret,
        };
        validator = new ExternalJWTValidator(configWithWhitespaceSecret);
        (validator as any).tokenValidator = mockTokenValidator;

        const payload: JWTPayload = {
          sub: 'user_123',
          iss: 'https://example.com/',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = jwt.sign(payload, 'any-secret');

        // Mock JWT verification failure due to invalid secret
        const verificationError = new AuthError(
          'JWT verification failed: invalid algorithm',
          undefined,
          'Check token validity and secret key configuration'
        );
        mockTokenValidator.verify.mockRejectedValue(verificationError);

        await expect(validator.verify(token)).rejects.toThrow(AuthError);
        await expect(validator.verify(token)).rejects.toThrow(
          'JWT verification failed'
        );
      }
    );

    // Property-based test for token verification failures
    test.prop([
      fc.string({ minLength: 32, maxLength: 64 }), // Correct secret
      fc.string({ minLength: 32, maxLength: 64 }), // Wrong secret
      fc.webUrl({ validSchemes: ['https'] }),
    ])(
      'should handle verification failures with wrong secret',
      async (correctSecret, wrongSecret, issuer) => {
        fc.pre(correctSecret !== wrongSecret); // Ensure secrets are different

        const configWithSecret = {
          ...mockConfig,
          EXTERNAL_JWT_SECRET: wrongSecret,
        };
        validator = new ExternalJWTValidator(configWithSecret);
        (validator as any).tokenValidator = mockTokenValidator;

        const payload: JWTPayload = {
          sub: 'user_123',
          iss: issuer,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        // Token signed with one secret, verified with another
        const token = jwt.sign(payload, correctSecret, { algorithm: 'HS256' });

        // Mock verification failure
        const verificationError = new AuthError(
          'JWT verification failed: invalid signature',
          undefined,
          'Check token validity and public key configuration'
        );
        mockTokenValidator.verify.mockRejectedValue(verificationError);

        await expect(validator.verify(token)).rejects.toThrow(AuthError);
        await expect(validator.verify(token)).rejects.toThrow(
          'JWT verification failed'
        );
      }
    );

    // Test policy validation failures (order matters: issuer -> audience -> claims)
    it('should propagate issuer validation errors', async () => {
      const payload: JWTPayload = {
        sub: 'user_123',
        iss: 'https://invalid.com/',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, testSecrets.simple);
      mockTokenValidator.verify.mockResolvedValue(payload);

      const validationError = new AuthError(
        'Issuer validation failed',
        undefined
      );
      mockPolicy.validateIssuer.mockImplementation(() => {
        throw validationError;
      });

      await expect(validator.verify(token)).rejects.toThrow(AuthError);
      await expect(validator.verify(token)).rejects.toThrow(
        'Issuer validation failed'
      );
    });

    it('should propagate audience validation errors', async () => {
      const payload: JWTPayload = {
        sub: 'user_123',
        iss: 'https://valid.com/',
        aud: 'wrong-audience',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, testSecrets.simple);
      mockTokenValidator.verify.mockResolvedValue(payload);

      // Don't throw on issuer validation
      mockPolicy.validateIssuer.mockImplementation(() => {});
      // Throw on audience validation
      const validationError = new AuthError(
        'Audience validation failed',
        undefined
      );
      mockPolicy.validateAudience.mockImplementation(() => {
        throw validationError;
      });

      await expect(validator.verify(token)).rejects.toThrow(AuthError);
      await expect(validator.verify(token)).rejects.toThrow(
        'Audience validation failed'
      );
    });

    it('should propagate claims validation errors', async () => {
      const payload: JWTPayload = {
        // Missing required claims
        iss: 'https://valid.com/',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, testSecrets.simple);
      mockTokenValidator.verify.mockResolvedValue(payload);

      // Don't throw on issuer and audience validation
      mockPolicy.validateIssuer.mockImplementation(() => {});
      mockPolicy.validateAudience.mockImplementation(() => {});
      // Throw on claims validation
      const validationError = new AuthError(
        'Claims validation failed',
        undefined
      );
      mockPolicy.validateClaims.mockImplementation(() => {
        throw validationError;
      });

      await expect(validator.verify(token)).rejects.toThrow(AuthError);
      await expect(validator.verify(token)).rejects.toThrow(
        'Claims validation failed'
      );
    });
  });

  describe('Key Format Handling', () => {
    // Property-based test for different secret encodings
    test.prop([
      fc.oneof(
        // Plain text secrets
        fc
          .string({ minLength: 32, maxLength: 128 })
          .filter(s => !/[^\x20-\x7E]/.test(s)), // ASCII only

        // Base64 encoded secrets
        fc
          .string({ minLength: 24, maxLength: 96 })
          .map(s => Buffer.from(s).toString('base64')),

        // Hex encoded secrets
        fc
          .string({ minLength: 16, maxLength: 64 })
          .map(s => Buffer.from(s).toString('hex')),

        // UUID-like secrets
        fc.uuid(),

        // JWT-like secrets (base64url)
        fc
          .string({ minLength: 32, maxLength: 128 })
          .map(s => Buffer.from(s).toString('base64url'))
      ),
    ])('should handle various secret key formats', async secretKey => {
      const configWithSecret = {
        ...mockConfig,
        EXTERNAL_JWT_SECRET: secretKey,
      };
      validator = new ExternalJWTValidator(configWithSecret);
      (validator as any).tokenValidator = mockTokenValidator;
      (validator as any).policy = mockPolicy;

      const payload: JWTPayload = {
        sub: 'user_123',
        iss: 'https://test.example.com/',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, secretKey);
      mockTokenValidator.verify.mockResolvedValue(payload);

      const result = await validator.verify(token);

      expect(result).toEqual(payload);
      expect(mockTokenValidator.verify).toHaveBeenCalledWith(token, secretKey);
    });

    // Test PEM format handling (though not typical for HMAC)
    it('should handle PEM-formatted secrets gracefully', async () => {
      const pemFormattedSecret = `-----BEGIN SECRET-----
${Buffer.from('test-secret-key-for-testing-purposes').toString('base64')}
-----END SECRET-----`;

      const configWithPemSecret = {
        ...mockConfig,
        EXTERNAL_JWT_SECRET: pemFormattedSecret,
      };
      validator = new ExternalJWTValidator(configWithPemSecret);
      (validator as any).tokenValidator = mockTokenValidator;
      (validator as any).policy = mockPolicy;

      const payload: JWTPayload = {
        sub: 'user_123',
        iss: 'https://test.example.com/',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = jwt.sign(payload, pemFormattedSecret);
      mockTokenValidator.verify.mockResolvedValue(payload);

      const result = await validator.verify(token);

      expect(result).toEqual(payload);
      expect(mockTokenValidator.verify).toHaveBeenCalledWith(
        token,
        pemFormattedSecret
      );
    });

    // Test line ending variations
    test.prop([
      fc.string({ minLength: 32, maxLength: 128 }),
      fc.constantFrom('\n', '\r\n', '\r'), // Different line endings
    ])(
      'should handle secrets with various line endings',
      async (baseSecret, lineEnding) => {
        const secretWithLineEndings =
          baseSecret + lineEnding + 'additional-content' + lineEnding;

        const configWithSecret = {
          ...mockConfig,
          EXTERNAL_JWT_SECRET: secretWithLineEndings,
        };
        validator = new ExternalJWTValidator(configWithSecret);
        (validator as any).tokenValidator = mockTokenValidator;
        (validator as any).policy = mockPolicy;

        const payload: JWTPayload = {
          sub: 'user_123',
          iss: 'https://test.example.com/',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = jwt.sign(payload, secretWithLineEndings);
        mockTokenValidator.verify.mockResolvedValue(payload);

        const result = await validator.verify(token);

        expect(result).toEqual(payload);
        expect(mockTokenValidator.verify).toHaveBeenCalledWith(
          token,
          secretWithLineEndings
        );
      }
    );
  });

  describe('Algorithm Validation', () => {
    // Property-based test for HMAC algorithm variations
    test.prop([
      fc.constantFrom('HS256', 'HS384', 'HS512'),
      fc.string({ minLength: 32, maxLength: 128 }),
    ])(
      'should work with different HMAC algorithms',
      async (algorithm, secret) => {
        const configWithSecret = { ...mockConfig, EXTERNAL_JWT_SECRET: secret };
        validator = new ExternalJWTValidator(configWithSecret);
        (validator as any).tokenValidator = mockTokenValidator;
        (validator as any).policy = mockPolicy;

        const payload: JWTPayload = {
          sub: 'user_123',
          iss: 'https://test.example.com/',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = jwt.sign(payload, secret, {
          algorithm: algorithm as any,
        });
        mockTokenValidator.verify.mockResolvedValue(payload);

        const result = await validator.verify(token);

        expect(result).toEqual(payload);
      }
    );

    // Test algorithm mismatch scenarios
    test.prop([
      fc.constantFrom('RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'), // Public key algorithms
    ])(
      'should handle algorithm mismatches appropriately',
      async _publicKeyAlgorithm => {
        // This would fail in real JWT verification, but we're testing error handling
        const token = `header.payload.signature`; // Mock token structure

        const algorithmError = new AuthError(
          `JWT verification failed: algorithm mismatch`,
          undefined,
          'Secret key validation requires HMAC algorithms (HS256, HS384, HS512)'
        );
        mockTokenValidator.verify.mockRejectedValue(algorithmError);

        await expect(validator.verify(token)).rejects.toThrow(AuthError);
        await expect(validator.verify(token)).rejects.toThrow(
          'algorithm mismatch'
        );
      }
    );
  });

  describe('Legacy Key Validation Edge Cases', () => {
    // Test very short secrets (security edge case)
    test.prop([
      fc.string({ minLength: 1, maxLength: 15 }), // Too short for security
    ])(
      'should handle short secrets based on JWT library behavior',
      async shortSecret => {
        const configWithShortSecret = {
          ...mockConfig,
          EXTERNAL_JWT_SECRET: shortSecret,
        };
        validator = new ExternalJWTValidator(configWithShortSecret);
        (validator as any).tokenValidator = mockTokenValidator;
        (validator as any).policy = mockPolicy;

        const payload: JWTPayload = {
          sub: 'user_123',
          iss: 'https://test.example.com/',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = jwt.sign(payload, shortSecret);

        // JWT library may accept or reject short secrets - we test error handling
        const shortKeyError = new AuthError(
          'JWT verification failed: key too short',
          undefined,
          'Use secrets of at least 32 characters for security'
        );
        mockTokenValidator.verify.mockRejectedValue(shortKeyError);

        await expect(validator.verify(token)).rejects.toThrow(AuthError);
      }
    );

    // Test binary secrets
    it('should handle binary secret keys', async () => {
      const binarySecret = Buffer.from([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
      ]);

      const configWithBinarySecret = {
        ...mockConfig,
        EXTERNAL_JWT_SECRET: binarySecret.toString('binary'),
      };
      validator = new ExternalJWTValidator(configWithBinarySecret);
      (validator as any).tokenValidator = mockTokenValidator;
      (validator as any).policy = mockPolicy;

      const payload: JWTPayload = {
        sub: 'user_123',
        iss: 'https://test.example.com/',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = 'mock-token';
      mockTokenValidator.verify.mockResolvedValue(payload);

      const result = await validator.verify(token);

      expect(result).toEqual(payload);
      expect(mockTokenValidator.verify).toHaveBeenCalledWith(
        token,
        binarySecret.toString('binary')
      );
    });

    // Test Unicode secrets
    test.prop([
      fc
        .string({ minLength: 32, maxLength: 128 })
        .filter(s => /[\u0080-\uFFFF]/.test(s)), // Contains non-ASCII Unicode
    ])('should handle Unicode secrets correctly', async unicodeSecret => {
      const configWithUnicodeSecret = {
        ...mockConfig,
        EXTERNAL_JWT_SECRET: unicodeSecret,
      };
      validator = new ExternalJWTValidator(configWithUnicodeSecret);
      (validator as any).tokenValidator = mockTokenValidator;
      (validator as any).policy = mockPolicy;

      const payload: JWTPayload = {
        sub: 'user_123',
        iss: 'https://test.example.com/',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = 'mock-token';
      mockTokenValidator.verify.mockResolvedValue(payload);

      const result = await validator.verify(token);

      expect(result).toEqual(payload);
      expect(mockTokenValidator.verify).toHaveBeenCalledWith(
        token,
        unicodeSecret
      );
    });
  });

  describe('Concurrent Verification', () => {
    // Property-based test for concurrent token verification
    test.prop([
      fc.integer({ min: 2, max: 20 }), // Concurrent request count
      fc.string({ minLength: 32, maxLength: 128 }), // Secret
    ])(
      'should handle concurrent verification requests correctly',
      async (concurrentCount, secret) => {
        const configWithSecret = { ...mockConfig, EXTERNAL_JWT_SECRET: secret };
        validator = new ExternalJWTValidator(configWithSecret);
        (validator as any).tokenValidator = mockTokenValidator;
        (validator as any).policy = mockPolicy;

        const payload: JWTPayload = {
          sub: 'user_123',
          iss: 'https://concurrent.example.com/',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = jwt.sign(payload, secret);

        // Mock successful verification
        mockTokenValidator.verify.mockResolvedValue(payload);

        // Fire concurrent verification requests
        const promises = Array(concurrentCount)
          .fill(0)
          .map(() => validator.verify(token));
        const results = await Promise.all(promises);

        // All should succeed with the same payload
        results.forEach(result => {
          expect(result).toEqual(payload);
        });

        // Verify method should be called for each request
        expect(mockTokenValidator.verify).toHaveBeenCalledTimes(
          concurrentCount
        );
      }
    );
  });

  describe('extractUserId - User ID Extraction', () => {
    // Property-based test for user ID extraction patterns
    test.prop([
      fc.oneof(
        fc.record({
          sub: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        }),
        fc.record({
          userId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        }),
        fc.record({
          user_id: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        }),
        fc.record({ email: fc.emailAddress() }) // Email as fallback
      ),
    ])('should extract user ID from various payload formats', payload => {
      const result = validator.extractUserId(payload as JWTPayload);

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.trim().length).toBeGreaterThan(0);
    });

    // Test provider-specific ID formats
    test.prop([
      fc.oneof(
        fc.string().map(s => `auth0|${s}`), // Auth0 format
        fc.string().map(s => `google-oauth2|${s}`), // Google format
        fc.string().map(s => `facebook|${s}`), // Facebook format
        fc.uuid(), // Standard UUID
        fc.integer({ min: 1000, max: 999999 }).map(n => n.toString()) // Numeric ID
      ),
    ])('should handle provider-specific user ID formats', providerId => {
      mockTokenValidator.extractUserId.mockImplementation(() =>
        providerId.replace(/^[^|]*\|/, '')
      );

      const result = validator.extractUserId({ sub: providerId });

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('Validator Properties', () => {
    it('should have correct validator name', () => {
      expect(validator.name).toBe('external-secret');
    });

    it('should implement JWTValidator interface correctly', () => {
      expect(validator).toHaveProperty('canHandle');
      expect(validator).toHaveProperty('verify');
      expect(validator).toHaveProperty('extractUserId');
      expect(typeof validator.canHandle).toBe('function');
      expect(typeof validator.verify).toBe('function');
      expect(typeof validator.extractUserId).toBe('function');
    });

    it('should extend BaseValidator', () => {
      expect(validator).toHaveProperty('tokenValidator');
      expect(validator).toHaveProperty('policy');
    });
  });

  describe('Production vs Development Behavior', () => {
    // Test production environment restrictions
    test.prop([fc.webUrl({ validSchemes: ['https'] })])(
      'should respect production environment restrictions',
      issuer => {
        const prodConfig = {
          ...mockConfig,
          NODE_ENV: 'production',
          EXTERNAL_JWT_ISSUER: issuer,
        };
        const prodValidator = new ExternalJWTValidator(prodConfig);
        (prodValidator as any).tokenValidator = mockTokenValidator;
        (prodValidator as any).policy = mockPolicy;

        const payload = {
          sub: 'user_123',
          iss: issuer,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        mockTokenValidator.decode.mockReturnValue({
          header: { alg: 'HS256' },
          payload: payload,
          signature: 'mock-signature',
        });

        // In production, policy should be more restrictive
        mockPolicy.canHandleIssuer.mockImplementation(
          (iss: string | undefined) => {
            return iss === issuer; // Only handle configured issuer
          }
        );

        const token = jwt.sign(payload, testSecrets.simple);
        expect(prodValidator.canHandle(token)).toBe(true);

        // Test with different issuer - should be rejected
        const differentPayload = { ...payload, iss: 'https://different.com/' };
        mockTokenValidator.decode.mockReturnValue({
          header: { alg: 'HS256' },
          payload: differentPayload,
          signature: 'mock-signature',
        });

        const differentToken = jwt.sign(differentPayload, testSecrets.simple);
        expect(prodValidator.canHandle(differentToken)).toBe(false);
      }
    );
  });
});
