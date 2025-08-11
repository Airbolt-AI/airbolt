import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type MockedFunction,
} from 'vitest';
import type { FastifyLoggerInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import {
  createClerkProvider,
  isClerkClaims,
  isClerkUserSession,
  hasClerkOrganizationContext,
} from './clerk-provider.js';
import type {
  VerifyContext,
  ClerkProviderConfig,
  AuthProvider,
} from '../types/provider.js';
import type { JWTClaims } from '../../types/auth.js';
import { AuditEventType } from '../audit-logger.js';
import { ProviderPriority } from '../types/provider.js';
import * as clerkVerifier from '../clerk-verifier.js';
import * as issuerValidator from '../issuer-validator.js';

// Mock the clerk-verifier module
vi.mock('../clerk-verifier.js');
vi.mock('../issuer-validator.js');

const mockVerifyClerkToken = clerkVerifier.verifyClerkToken as MockedFunction<
  typeof clerkVerifier.verifyClerkToken
>;
const mockDetectIssuerType = issuerValidator.detectIssuerType as MockedFunction<
  typeof issuerValidator.detectIssuerType
>;

describe('ClerkProvider', () => {
  let provider: AuthProvider;
  let mockLogger: FastifyLoggerInstance;
  let mockContext: VerifyContext;
  let validConfig: ClerkProviderConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Valid Clerk provider configuration
    validConfig = {
      provider: 'clerk',
      authorizedParties: ['https://myapp.com', 'https://admin.myapp.com'],
      publishableKey: 'pk_test_example123',
      secretKey: 'sk_test_secret456',
    };

    // Create provider instance
    provider = createClerkProvider(validConfig);

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any;

    // Mock JWKS cache
    const mockJWKSCache = {
      getOrCreate: vi.fn().mockReturnValue(vi.fn()),
      clear: vi.fn(),
      size: vi.fn().mockReturnValue(1),
      has: vi.fn().mockReturnValue(true),
    };

    // Mock verification context
    mockContext = {
      jwksCache: mockJWKSCache,
      logger: mockLogger,
      config: {
        mode: 'development',
        validateJWT: true,
        providers: [validConfig],
        rateLimits: {
          exchange: {
            max: 10,
            windowMs: 900000,
          },
        },
      },
    };

    // Setup default mocks
    mockDetectIssuerType.mockReturnValue(issuerValidator.IssuerType.CLERK);
  });

  describe('Constructor and Configuration', () => {
    it('should create provider with correct name and priority', () => {
      expect(provider.name).toBe('clerk');
      expect(provider.priority).toBe(ProviderPriority.CLERK);
    });

    it('should store configuration correctly', () => {
      const config: ClerkProviderConfig = {
        provider: 'clerk',
        authorizedParties: ['https://app.example.com'],
      };

      const testProvider = createClerkProvider(config);
      expect(testProvider.name).toBe('clerk');
      expect(testProvider.priority).toBe(10); // Highest priority
    });

    it('should validate configuration during construction', () => {
      // Just verify the provider can be created without throwing
      expect(() => createClerkProvider(validConfig)).not.toThrow();
      // Configuration validation happens during creation
    });
  });

  describe('canHandle', () => {
    it('should handle Clerk issuers', () => {
      const clerkIssuer = 'https://test-app.clerk.accounts.dev';

      expect(provider.canHandle(clerkIssuer)).toBe(true);
      expect(mockDetectIssuerType).toHaveBeenCalledWith(clerkIssuer);
    });

    it('should reject non-Clerk issuers', () => {
      mockDetectIssuerType.mockReturnValue(issuerValidator.IssuerType.AUTH0);
      const auth0Issuer = 'https://tenant.auth0.com/';

      expect(provider.canHandle(auth0Issuer)).toBe(false);
    });

    it('should reject invalid issuers', () => {
      expect(provider.canHandle('')).toBe(false);
      expect(provider.canHandle(null as any)).toBe(false);
      expect(provider.canHandle(undefined as any)).toBe(false);
    });

    it('should handle various Clerk issuer formats', () => {
      const clerkIssuers = [
        'https://my-app.clerk.accounts.dev',
        'https://production-app.clerk.accounts.dev',
        'https://staging-123.clerk.accounts.dev',
      ];

      clerkIssuers.forEach(issuer => {
        expect(provider.canHandle(issuer)).toBe(true);
      });
    });
  });

  describe('verify', () => {
    let validToken: string;
    let mockClerkClaims: clerkVerifier.ClerkJWTClaims;

    beforeEach(() => {
      // Create a valid-looking JWT for testing
      const now = Math.floor(Date.now() / 1000);
      validToken = jwt.sign(
        {
          sub: 'user_12345',
          iss: 'https://test-app.clerk.accounts.dev',
          exp: now + 3600,
          iat: now,
          aud: 'https://myapp.com',
        },
        'test-secret'
      );

      // Mock successful Clerk verification result
      mockClerkClaims = {
        sub: 'user_12345',
        iss: 'https://test-app.clerk.accounts.dev',
        exp: now + 3600,
        iat: now,
        aud: 'https://myapp.com',
        email: 'test@example.com',
        session_id: 'sess_abc123',
        org_id: 'org_xyz789',
        org_slug: 'acme-corp',
        org_role: 'admin',
        azp: 'https://myapp.com',
      };

      mockVerifyClerkToken.mockResolvedValue(mockClerkClaims);
    });

    it('should successfully verify valid Clerk token', async () => {
      const claims = await provider.verify(validToken, mockContext);

      expect(claims).toEqual(mockClerkClaims);
      expect(mockVerifyClerkToken).toHaveBeenCalledWith(validToken, {
        authorizedParties: validConfig.authorizedParties,
      });
    });

    it('should pass authorized parties to Clerk verifier', async () => {
      await provider.verify(validToken, mockContext);

      expect(mockVerifyClerkToken).toHaveBeenCalledWith(
        validToken,
        expect.objectContaining({
          authorizedParties: ['https://myapp.com', 'https://admin.myapp.com'],
        })
      );
    });

    it('should work without authorized parties configured', async () => {
      const configWithoutParties: ClerkProviderConfig = {
        provider: 'clerk',
      };
      const providerWithoutParties = createClerkProvider(configWithoutParties);

      await providerWithoutParties.verify(validToken, mockContext);

      expect(mockVerifyClerkToken).toHaveBeenCalledWith(validToken, {});
    });

    it('should reject token with non-Clerk issuer', async () => {
      mockDetectIssuerType.mockReturnValue(issuerValidator.IssuerType.AUTH0);

      await expect(provider.verify(validToken, mockContext)).rejects.toThrow(
        'Token issuer validation failed'
      );
    });

    it('should handle verification failures', async () => {
      const verificationError = new Error(
        'Token signature verification failed'
      );
      mockVerifyClerkToken.mockRejectedValue(verificationError);

      await expect(provider.verify(validToken, mockContext)).rejects.toThrow();

      // Should log security event for failure
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'clerk',
          event: AuditEventType.AUTH_JWT_VERIFICATION_FAILURE,
        }),
        expect.stringContaining('JWT verification failed')
      );
    });

    it('should log successful verification with context', async () => {
      await provider.verify(validToken, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'clerk',
          event: AuditEventType.AUTH_TOKEN_EXCHANGE_SUCCESS,
          userId: 'user_123...',
          sessionId: 'sess_abc123',
          orgId: 'org_xyz7...',
          hasAuthorizedParty: true,
        }),
        expect.stringContaining('Token exchange successful')
      );
    });

    it('should handle tokens without optional Clerk claims', async () => {
      const basicClaims: clerkVerifier.ClerkJWTClaims = {
        sub: 'user_12345',
        iss: 'https://test-app.clerk.accounts.dev',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      mockVerifyClerkToken.mockResolvedValue(basicClaims);

      const claims = await provider.verify(validToken, mockContext);

      expect(claims).toEqual(basicClaims);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: undefined,
          orgId: undefined,
          hasAuthorizedParty: false,
        }),
        expect.any(String)
      );
    });

    it('should handle invalid token format', async () => {
      const invalidToken = 'invalid.token.format';

      await expect(
        provider.verify(invalidToken, mockContext)
      ).rejects.toThrow();
    });

    it('should handle empty token', async () => {
      await expect(provider.verify('', mockContext)).rejects.toThrow();
    });

    it('should sanitize sensitive data in logs', async () => {
      const claimsWithLongIds = {
        ...mockClerkClaims,
        sub: 'user_very_long_user_id_that_should_be_truncated',
        session_id: 'sess_very_long_session_id_that_should_be_truncated',
        org_id: 'org_very_long_organization_id_that_should_be_truncated',
      };
      mockVerifyClerkToken.mockResolvedValue(claimsWithLongIds);

      await provider.verify(validToken, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_ver...',
          sessionId: 'sess_very_lo...',
          orgId: 'org_very...',
        }),
        'Token exchange successful for clerk provider'
      );
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      // Configuration validation happens during provider creation
      expect(() => createClerkProvider(validConfig)).not.toThrow();
    });

    it('should require provider to be "clerk"', () => {
      const invalidConfig = { provider: 'auth0' } as any;

      expect(() => createClerkProvider(invalidConfig)).toThrow(
        'Clerk provider configuration must have provider set to "clerk"'
      );
    });

    it('should validate authorized parties format', () => {
      const configWithInvalidParties: ClerkProviderConfig = {
        provider: 'clerk',
        authorizedParties: 'not-an-array' as any,
      };

      expect(() => createClerkProvider(configWithInvalidParties)).toThrow(
        'Clerk authorizedParties must be an array of URLs'
      );
    });

    it('should validate individual authorized party URLs', () => {
      const configWithInvalidURL: ClerkProviderConfig = {
        provider: 'clerk',
        authorizedParties: ['https://valid.com', 'invalid-url', ''],
      };

      expect(() => createClerkProvider(configWithInvalidURL)).toThrow();
    });

    it('should validate issuer URL format if provided', () => {
      const configWithInvalidIssuer: ClerkProviderConfig = {
        provider: 'clerk',
        issuer: 'invalid-url',
      };

      expect(() => createClerkProvider(configWithInvalidIssuer)).toThrow(
        'Clerk issuer must be a valid URL'
      );
    });

    it('should validate issuer matches Clerk pattern', () => {
      mockDetectIssuerType.mockReturnValue(issuerValidator.IssuerType.AUTH0);

      const configWithNonClerkIssuer: ClerkProviderConfig = {
        provider: 'clerk',
        issuer: 'https://tenant.auth0.com',
      };

      expect(() => createClerkProvider(configWithNonClerkIssuer)).toThrow(
        'Clerk issuer must match Clerk domain pattern'
      );
    });

    it('should validate publishable key format', () => {
      const configWithInvalidPK: ClerkProviderConfig = {
        provider: 'clerk',
        publishableKey: 'invalid_key_format',
      };

      expect(() => createClerkProvider(configWithInvalidPK)).toThrow(
        'Clerk publishable key must start with "pk_"'
      );
    });

    it('should validate secret key format', () => {
      const configWithInvalidSK: ClerkProviderConfig = {
        provider: 'clerk',
        secretKey: 'invalid_key_format',
      };

      expect(() => createClerkProvider(configWithInvalidSK)).toThrow(
        'Clerk secret key must start with "sk_"'
      );
    });

    it('should allow valid key formats', () => {
      const configWithValidKeys: ClerkProviderConfig = {
        provider: 'clerk',
        publishableKey: 'pk_test_valid123',
        secretKey: 'sk_test_secret456',
      };

      expect(() => createClerkProvider(configWithValidKeys)).not.toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create provider instance', () => {
      const config: ClerkProviderConfig = {
        provider: 'clerk',
        authorizedParties: ['https://app.com'],
      };

      const factoryProvider = createClerkProvider(config);

      expect(factoryProvider).toBeDefined();
      expect(typeof factoryProvider.verify).toBe('function');
      expect(factoryProvider.name).toBe('clerk');
      expect(factoryProvider.priority).toBe(ProviderPriority.CLERK);
    });
  });

  describe('Type Guards and Helpers', () => {
    describe('isClerkClaims', () => {
      it('should identify Clerk claims by session_id', () => {
        const clerkClaims: JWTClaims = {
          sub: 'user_123',
          iss: 'https://clerk.dev',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          session_id: 'sess_abc',
        };

        expect(isClerkClaims(clerkClaims)).toBe(true);
      });

      it('should identify Clerk claims by org_id', () => {
        const clerkClaims: JWTClaims = {
          sub: 'user_123',
          iss: 'https://clerk.dev',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          org_id: 'org_123',
        };

        expect(isClerkClaims(clerkClaims)).toBe(true);
      });

      it('should identify Clerk claims by org_slug', () => {
        const clerkClaims: JWTClaims = {
          sub: 'user_123',
          iss: 'https://clerk.dev',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          org_slug: 'acme',
        };

        expect(isClerkClaims(clerkClaims)).toBe(true);
      });

      it('should identify Clerk claims by azp', () => {
        const clerkClaims: JWTClaims = {
          sub: 'user_123',
          iss: 'https://clerk.dev',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          azp: 'https://app.com',
        };

        expect(isClerkClaims(clerkClaims)).toBe(true);
      });

      it('should not identify basic JWT claims as Clerk', () => {
        const basicClaims: JWTClaims = {
          sub: 'user_123',
          iss: 'https://other.com',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
        };

        expect(isClerkClaims(basicClaims)).toBe(false);
      });
    });

    describe('isClerkUserSession', () => {
      it('should identify active user sessions', () => {
        const sessionClaims: clerkVerifier.ClerkJWTClaims = {
          sub: 'user_123',
          iss: 'https://clerk.dev',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          session_id: 'sess_abc',
        };

        expect(isClerkUserSession(sessionClaims)).toBe(true);
      });

      it('should reject claims without session_id', () => {
        const claimsWithoutSession: clerkVerifier.ClerkJWTClaims = {
          sub: 'user_123',
          iss: 'https://clerk.dev',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
        };

        expect(isClerkUserSession(claimsWithoutSession)).toBe(false);
      });

      it('should reject claims without sub', () => {
        const claimsWithoutSub: clerkVerifier.ClerkJWTClaims = {
          sub: '',
          iss: 'https://clerk.dev',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          session_id: 'sess_abc',
        };

        expect(isClerkUserSession(claimsWithoutSub)).toBe(false);
      });
    });

    describe('hasClerkOrganizationContext', () => {
      it('should detect organization context by org_id', () => {
        const orgClaims: clerkVerifier.ClerkJWTClaims = {
          sub: 'user_123',
          iss: 'https://clerk.dev',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          org_id: 'org_abc',
        };

        expect(hasClerkOrganizationContext(orgClaims)).toBe(true);
      });

      it('should detect organization context by org_slug', () => {
        const orgClaims: clerkVerifier.ClerkJWTClaims = {
          sub: 'user_123',
          iss: 'https://clerk.dev',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          org_slug: 'acme-corp',
        };

        expect(hasClerkOrganizationContext(orgClaims)).toBe(true);
      });

      it('should not detect org context without org fields', () => {
        const basicClaims: clerkVerifier.ClerkJWTClaims = {
          sub: 'user_123',
          iss: 'https://clerk.dev',
          exp: Date.now() / 1000 + 3600,
          iat: Date.now() / 1000,
          session_id: 'sess_abc',
        };

        expect(hasClerkOrganizationContext(basicClaims)).toBe(false);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed tokens gracefully', async () => {
      const malformedToken = 'malformed.token';

      await expect(
        provider.verify(malformedToken, mockContext)
      ).rejects.toThrow();
    });

    it('should handle Clerk verifier errors', async () => {
      mockVerifyClerkToken.mockRejectedValue(new Error('Clerk API error'));

      const validToken = jwt.sign(
        {
          sub: 'user_123',
          iss: 'https://clerk.accounts.dev',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
        'secret'
      );

      await expect(provider.verify(validToken, mockContext)).rejects.toThrow();
    });

    it('should handle issuer detection failures', () => {
      mockDetectIssuerType.mockReturnValue(issuerValidator.IssuerType.UNKNOWN);

      expect(provider.canHandle('https://unknown-issuer.com')).toBe(false);
    });

    it('should safely extract issuer for error logging', async () => {
      const invalidToken = 'totally-invalid-token';
      mockVerifyClerkToken.mockRejectedValue(new Error('Token invalid'));

      await expect(
        provider.verify(invalidToken, mockContext)
      ).rejects.toThrow();

      // Should log with 'unknown' issuer when extraction fails
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          issuer: 'unknown',
        }),
        expect.any(String)
      );
    });
  });

  describe('Integration with BaseAuthProvider', () => {
    it('should use base provider token validation', async () => {
      const expiredToken = jwt.sign(
        {
          sub: 'user_123',
          iss: 'https://clerk.accounts.dev',
          exp: Math.floor(Date.now() / 1000) - 10, // Expired
          iat: Math.floor(Date.now() / 1000) - 3600,
        },
        'secret'
      );

      await expect(
        provider.verify(expiredToken, mockContext)
      ).rejects.toThrow();
    });

    it('should use base provider error handling', async () => {
      const error = new Error('Signature verification failed');
      mockVerifyClerkToken.mockRejectedValue(error);

      const token = jwt.sign(
        { sub: 'user_123', iss: 'https://clerk.dev' },
        'secret'
      );

      const result = await provider
        .verify(token, mockContext)
        .catch(err => err);

      expect(result.provider).toBe('clerk');
      expect(result.code).toBeDefined();
    });

    it('should use base provider logging utilities', async () => {
      // Create mock claims for this test
      const testClaims: clerkVerifier.ClerkJWTClaims = {
        sub: 'user_123',
        iss: 'https://clerk.dev',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      // Reset mock to successful verification
      mockVerifyClerkToken.mockResolvedValue(testClaims);

      await provider.verify(
        jwt.sign(
          {
            sub: 'user_123',
            iss: 'https://clerk.dev',
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
          },
          'secret'
        ),
        mockContext
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          provider: 'clerk',
        }),
        expect.any(String)
      );
    });
  });
});
