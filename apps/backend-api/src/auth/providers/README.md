# Authentication Providers

This directory contains the base authentication provider infrastructure and implementations for different JWT/OIDC providers.

## Architecture

### BaseAuthProvider

The `BaseAuthProvider` is an abstract class that provides common functionality for all authentication providers:

- **JWT Token Parsing**: Safe parsing of JWT tokens without cryptographic verification
- **Format Validation**: Validates token structure, required claims, and expiration
- **Error Handling**: Standardized error handling with consistent `ProviderError` format
- **Security Logging**: Structured audit logging for authentication events
- **JWKS Integration**: Helper methods for JWKS key retrieval and caching
- **Configuration Validation**: Base configuration validation patterns

### Key Features

#### Common Functionality

- `extractIssuer(token)` - Extract issuer from token without full verification
- `validateTokenFormat(token)` - Basic JWT format and claims validation
- `getJWKS(issuer, context)` - JWKS key retrieval from cache
- `handleVerificationError(error)` - Standardized error handling
- `logSecurityEvent(event, context)` - Audit logging helper

#### Utility Methods

- `createHashKey(input, prefix?)` - SHA-256 hash generation for caching
- `sanitizeUserId(userId)` - Privacy-safe user ID truncation
- `performJWTVerification(token, key, options)` - Common jose verification logic
- `convertToJWTClaims(payload)` - Convert jose payload to our claims interface

### Provider Implementation

To create a new provider, extend `BaseAuthProvider` and implement the abstract methods:

```typescript
export class MyProvider extends BaseAuthProvider {
  readonly name = 'my-provider';
  readonly priority = ProviderPriority.CUSTOM_OIDC;

  constructor(config: MyProviderConfig) {
    super(config);
    // Additional setup
  }

  canHandle(issuer: string): boolean {
    // Provider-specific issuer matching logic
    return issuer.includes('my-provider.com');
  }

  async verify(token: string, context: VerifyContext): Promise<JWTClaims> {
    try {
      // 1. Validate token format (includes expiration)
      this.validateTokenFormat(token);

      // 2. Extract and validate issuer
      const issuer = this.extractIssuer(token);

      // 3. Perform cryptographic verification
      const getKey = this.getJWKS(issuer, context);
      const payload = await this.performJWTVerification(token, getKey, {
        issuer: 'expected-issuer',
        audience: 'expected-audience',
      });

      // 4. Convert to standard claims format
      const claims = this.convertToJWTClaims(payload);

      // 5. Log successful verification
      this.logSecurityEvent(
        'AUTH_TOKEN_EXCHANGE_SUCCESS' as any,
        {
          provider: this.name,
          issuer,
          userId: this.sanitizeUserId(claims.sub),
        },
        context.logger
      );

      return claims;
    } catch (error) {
      // Handle errors consistently
      const providerError = this.handleVerificationError(error);

      this.logSecurityEvent(
        'AUTH_JWT_VERIFICATION_FAILURE' as any,
        {
          provider: this.name,
          errorType: providerError.code,
          errorMessage: providerError.message,
        },
        context.logger
      );

      throw providerError;
    }
  }

  validateConfig(): void {
    // Provider-specific configuration validation
    if (!this.config.requiredField) {
      throw new Error('My provider requires requiredField');
    }
  }
}
```

### Error Handling

The base provider automatically converts various error types to consistent `ProviderError` format:

- **Token Expired**: `TOKEN_EXPIRED`
- **Invalid Signature**: `SIGNATURE_INVALID`
- **Invalid Audience**: `AUDIENCE_INVALID`
- **Invalid Issuer**: `ISSUER_INVALID`
- **Token Not Yet Valid**: `TOKEN_NOT_YET_VALID`
- **Key Retrieval Failed**: `KEY_RETRIEVAL_FAILED`
- **Generic Verification Failed**: `VERIFICATION_FAILED`

### Security Events

All providers automatically log security events:

- `AUTH_TOKEN_EXCHANGE_SUCCESS` - Successful token verification
- `AUTH_JWT_VERIFICATION_FAILURE` - Failed token verification
- `AUTH_PROVIDER_MISMATCH` - Token sent to wrong provider
- `AUTH_TOKEN_EXCHANGE_FAILURE` - General exchange failure

### Testing

The base provider comes with comprehensive tests. To test your provider:

```typescript
describe('MyProvider', () => {
  let provider: MyProvider;
  let mockContext: VerifyContext;

  beforeEach(() => {
    provider = new MyProvider({
      /* config */
    });
    mockContext = createMockVerifyContext();
  });

  it('should handle valid tokens', async () => {
    const token = createValidToken();
    const claims = await provider.verify(token, mockContext);
    expect(claims.sub).toBeDefined();
  });

  it('should reject invalid tokens', async () => {
    const token = 'invalid-token';
    await expect(provider.verify(token, mockContext)).rejects.toThrow();
  });
});
```

## File Structure

```
providers/
├── README.md              # This documentation
├── base-provider.ts       # Abstract base class
├── base-provider.test.ts  # Comprehensive base tests
└── example-provider.ts    # Example implementation
```

## Integration

Providers integrate with the `AuthProviderRegistry` which:

1. Registers providers by priority
2. Routes tokens to appropriate providers based on issuer
3. Provides single-flight coalescing for duplicate verifications
4. Manages shared infrastructure (JWKS cache, logging)

See the main auth documentation for integration details.
